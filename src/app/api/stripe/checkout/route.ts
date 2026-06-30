import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { tokensFromUsd } from "@/lib/format";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error("[stripe/checkout] Unauthenticated");
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (user.app_metadata?.role !== "admin") {
    console.error("[stripe/checkout] Non-admin attempted checkout", { userId: user.id });
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const workspaceId = user.app_metadata?.workspace_id as string | undefined;
  if (!workspaceId) {
    console.error("[stripe/checkout] No workspace_id on user", { userId: user.id });
    return NextResponse.json({ error: "No workspace" }, { status: 403 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.error("[stripe/checkout] STRIPE_SECRET_KEY not set");
    return NextResponse.json({ error: "Stripe is not configured on this server." }, { status: 503 });
  }

  let body: { amountUsd?: number };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { amountUsd } = body;
  if (!amountUsd || amountUsd < 1 || amountUsd > 10_000) {
    return NextResponse.json({ error: "amountUsd must be between 1 and 10000" }, { status: 400 });
  }

  const PLATFORM_FEE_RATE = 0.05;
  const netUsd = amountUsd * (1 - PLATFORM_FEE_RATE);
  const tokenAmount = Math.round(tokensFromUsd(netUsd));
  const usdCents = Math.round(amountUsd * 100);

  // Derive the origin from the incoming request so it works in dev and prod.
  const origin = request.headers.get("origin") ?? "http://localhost:3000";

  const stripe = new Stripe(stripeKey);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: usdCents,
            product_data: {
              name: `Tokeville Deposit — ${(tokenAmount / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 })}M TOK credited`,
              description: `Includes 5% platform fee. Net credit: $${netUsd.toFixed(2)} at $10 per 1M TOK.`,
            },
          },
        },
      ],
      metadata: {
        workspace_id: workspaceId,
        token_amount: String(tokenAmount),
        usd_cents: String(usdCents),
      },
      success_url: `${origin}/?deposit=success`,
      cancel_url: `${origin}/?deposit=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stripe session creation failed";
    console.error("[stripe/checkout] Stripe API error", { error: msg });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

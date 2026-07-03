import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { resolveTierPrice, selfServeTier } from "@/lib/stripeTiers";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error("[stripe/subscribe] Unauthenticated");
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (user.app_metadata?.role !== "admin") {
    console.error("[stripe/subscribe] Non-admin", { userId: user.id });
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  if (user.app_metadata?.workspace_type !== "institution") {
    return NextResponse.json({ error: "Only Institutional workspaces subscribe" }, { status: 400 });
  }

  const workspaceId = user.app_metadata?.workspace_id as string | undefined;
  if (!workspaceId) {
    return NextResponse.json({ error: "No workspace" }, { status: 403 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    console.error("[stripe/subscribe] STRIPE_SECRET_KEY not set");
    return NextResponse.json({ error: "Stripe is not configured on this server." }, { status: 503 });
  }

  // Which per-seat tier is being purchased (defaults to starter).
  let tierId = "starter";
  try {
    const body = await request.json();
    if (typeof body?.tier === "string") tierId = body.tier;
  } catch { /* empty body = starter */ }
  const parsed = selfServeTier(tierId);
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { tier } = parsed;

  const origin = request.headers.get("origin") ?? "http://localhost:3000";
  const stripe = new Stripe(stripeKey);

  try {
    const priceId = await resolveTierPrice(stripe, tier);
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ quantity: 1, price: priceId }],
      customer_email: user.email ?? undefined,
      metadata: { workspace_id: workspaceId, kind: "institution_subscription", tier: tier.id },
      subscription_data: { metadata: { workspace_id: workspaceId, tier: tier.id } },
      success_url: `${origin}/institution?subscription=success`,
      cancel_url: `${origin}/institution?subscription=cancelled`,
    });

    return NextResponse.json({ url: session.url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stripe session creation failed";
    console.error("[stripe/subscribe] Stripe API error", { error: msg });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

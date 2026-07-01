import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

/** Monthly price (USD cents) of the Tokeville Institutional subscription. */
const SUBSCRIPTION_PRICE_CENTS = 9900; // $99.00 / month

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

  const origin = request.headers.get("origin") ?? "http://localhost:3000";
  const stripe = new Stripe(stripeKey);

  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: SUBSCRIPTION_PRICE_CENTS,
            recurring: { interval: "month" },
            product_data: {
              name: "Tokeville Institutional",
              description: "Budget & track your organization's AI spend by department.",
            },
          },
        },
      ],
      customer_email: user.email ?? undefined,
      metadata: { workspace_id: workspaceId, kind: "institution_subscription" },
      subscription_data: { metadata: { workspace_id: workspaceId } },
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

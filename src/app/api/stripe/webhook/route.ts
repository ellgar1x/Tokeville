import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createServiceClient } from "@/lib/supabase/service";
import { tierById } from "@/lib/plans";

export async function POST(request: Request) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    console.error("[stripe/webhook] STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET not set");
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    console.error("[stripe/webhook] Missing stripe-signature header");
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  // Read raw body — required for signature verification.
  const rawBody = await request.text();

  const stripe = new Stripe(stripeKey);
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Signature verification failed";
    console.error("[stripe/webhook] Invalid signature", { error: msg });
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  // ─── Institutional subscription lifecycle ──────────────────────────────────
  if (event.type === "checkout.session.completed" &&
      (event.data.object as Stripe.Checkout.Session).mode === "subscription") {
    const session = event.data.object as Stripe.Checkout.Session;
    const workspaceId = session.metadata?.workspace_id;
    if (!workspaceId) {
      console.error("[stripe/webhook] Subscription session missing workspace_id", { sessionId: session.id });
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    // Approximate the first renewal date one month out (good enough for demo/test).
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    // Per-seat tier purchased (set by /api/stripe/subscribe); legacy sessions have none.
    const tier = tierById(session.metadata?.tier);

    const supabase = createServiceClient();
    const { error } = await supabase
      .from("workspaces")
      .update({
        subscription_status: "active",
        subscription_current_period_end: periodEnd,
        stripe_customer_id: typeof session.customer === "string" ? session.customer : null,
        stripe_subscription_id: typeof session.subscription === "string" ? session.subscription : null,
        ...(tier ? { institutional_tier: tier.id, institutional_seat_limit: tier.seatLimit } : {}),
      })
      .eq("id", workspaceId);

    if (error) {
      console.error("[stripe/webhook] activate subscription failed", { workspaceId, error: error.message });
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    console.log("[stripe/webhook] Subscription activated", { workspaceId });
    return NextResponse.json({ received: true });
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    const workspaceId = sub.metadata?.workspace_id;
    if (workspaceId) {
      const supabase = createServiceClient();
      await supabase.from("workspaces")
        .update({ subscription_status: "canceled" })
        .eq("id", workspaceId);
      console.log("[stripe/webhook] Subscription canceled", { workspaceId });
    }
    return NextResponse.json({ received: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { workspace_id, token_amount, usd_cents } = session.metadata ?? {};

    if (!workspace_id || !token_amount || !usd_cents) {
      console.error("[stripe/webhook] Missing metadata on session", { sessionId: session.id, metadata: session.metadata });
      return NextResponse.json({ error: "Missing metadata" }, { status: 400 });
    }

    if (session.payment_status !== "paid") {
      // Not paid yet (e.g. async payment method) — wait for payment_intent.succeeded.
      return NextResponse.json({ received: true });
    }

    const supabase = createServiceClient();
    const { error } = await supabase.rpc("mint_tokens", {
      p_workspace_id: workspace_id,
      p_token_amount: parseInt(token_amount, 10),
      p_usd_cents: parseInt(usd_cents, 10),
      p_stripe_session_id: session.id,
    });

    if (error) {
      console.error("[stripe/webhook] mint_tokens RPC failed", {
        sessionId: session.id,
        workspaceId: workspace_id,
        error: error.message,
      });
      // Return 500 so Stripe retries the webhook.
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    console.log("[stripe/webhook] Minted tokens", {
      sessionId: session.id,
      workspaceId: workspace_id,
      tokenAmount: token_amount,
      usdCents: usd_cents,
    });
  }

  return NextResponse.json({ received: true });
}

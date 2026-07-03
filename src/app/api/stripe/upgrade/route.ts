import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { resolveTierPrice, selfServeTier } from "@/lib/stripeTiers";

/**
 * POST /api/stripe/upgrade { tier } — change an Institutional workspace's
 * per-seat tier. With an active Stripe subscription the subscription item is
 * swapped to the new tier's price (prorated by Stripe) and the DB updates
 * immediately; without one the caller should use /api/stripe/subscribe.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (user.app_metadata?.role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }
  if (user.app_metadata?.workspace_type !== "institution") {
    return NextResponse.json({ error: "Only Institutional workspaces have per-seat tiers" }, { status: 400 });
  }
  const workspaceId = user.app_metadata?.workspace_id as string | undefined;
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 });

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) return NextResponse.json({ error: "Stripe is not configured on this server." }, { status: 503 });

  let body: { tier?: string };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const parsed = selfServeTier(body.tier ?? "");
  if ("error" in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });
  const { tier } = parsed;

  // RLS scopes this to the caller's workspace.
  const { data: ws, error: wsErr } = await supabase
    .from("workspaces")
    .select("id, subscription_status, stripe_subscription_id, institutional_tier")
    .eq("id", workspaceId)
    .single();
  if (wsErr || !ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  if (ws.institutional_tier === tier.id) {
    return NextResponse.json({ error: `You're already on the ${tier.label} plan.` }, { status: 400 });
  }
  if (ws.subscription_status !== "active" || !ws.stripe_subscription_id) {
    // No live subscription to modify — the client should run the normal checkout.
    return NextResponse.json({ error: "No active subscription — subscribe to a plan first.", needsCheckout: true }, { status: 409 });
  }

  const stripe = new Stripe(stripeKey);
  try {
    const priceId = await resolveTierPrice(stripe, tier);
    const sub = await stripe.subscriptions.retrieve(ws.stripe_subscription_id as string);
    const item = sub.items.data[0];
    if (!item) return NextResponse.json({ error: "Subscription has no items to update" }, { status: 502 });

    await stripe.subscriptions.update(sub.id, {
      items: [{ id: item.id, price: priceId }],
      proration_behavior: "create_prorations",
      metadata: { workspace_id: workspaceId, tier: tier.id },
    });

    // Reflect the new tier immediately (webhooks for sub updates aren't wired).
    const service = createServiceClient();
    const { error: dbErr } = await service
      .from("workspaces")
      .update({ institutional_tier: tier.id, institutional_seat_limit: tier.seatLimit })
      .eq("id", workspaceId);
    if (dbErr) {
      console.error("[stripe/upgrade] DB update failed after Stripe change", { workspaceId, tier: tier.id, error: dbErr.message });
      return NextResponse.json({ error: "Subscription updated in Stripe, but saving the plan failed — refresh and try again." }, { status: 500 });
    }

    console.log("[stripe/upgrade] Tier changed", { workspaceId, tier: tier.id });
    return NextResponse.json({ ok: true, tier: tier.id, seatLimit: tier.seatLimit });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Stripe subscription update failed";
    console.error("[stripe/upgrade] Stripe API error", { error: msg });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}

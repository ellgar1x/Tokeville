import type Stripe from "stripe";
import { tierById, type InstitutionalTier } from "@/lib/plans";

/**
 * Resolve the Stripe recurring price for a tier by lookup_key, creating the
 * product + price on the fly if it doesn't exist yet (idempotent by key).
 */
export async function resolveTierPrice(stripe: Stripe, tier: InstitutionalTier): Promise<string> {
  if (tier.priceUsd == null || !tier.lookupKey) throw new Error(`Tier ${tier.id} has no self-serve price`);
  const existing = await stripe.prices.list({ lookup_keys: [tier.lookupKey], limit: 1 });
  if (existing.data[0]) return existing.data[0].id;
  const product = await stripe.products.create({
    name: `Tokeville Institutional — ${tier.label}`,
    description: `Per-seat Institutional plan: ${tier.blurb.toLowerCase()}`,
  });
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: tier.priceUsd * 100,
    currency: "usd",
    recurring: { interval: "month" },
    lookup_key: tier.lookupKey,
  });
  return price.id;
}

/** Parse + validate a self-serve tier id from a request body. */
export function selfServeTier(tierId: string): { tier: InstitutionalTier } | { error: string } {
  const tier = tierById(tierId);
  if (!tier) return { error: `Unknown tier: ${tierId}` };
  if (tier.priceUsd == null || !tier.lookupKey) {
    return { error: "Enterprise is sales-led — contact us to set it up." };
  }
  return { tier };
}

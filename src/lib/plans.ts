/**
 * Institutional per-seat pricing tiers. Single source of truth used by the
 * landing page, the institution paywall/dashboard, the subscribe/upgrade
 * routes, and the member-add seat enforcement.
 *
 * "Active user" = a member who has logged at least one token spend event in
 * the current billing (calendar) month — billing scales with active users,
 * not departments. The Team (pay-as-you-go) workspace type is unaffected.
 */

export type InstitutionalTierId = "starter" | "team" | "scale" | "enterprise";

export interface InstitutionalTier {
  id: InstitutionalTierId;
  label: string;
  /** Monthly price in USD; null = custom (contact us). */
  priceUsd: number | null;
  /** Max active users; null = no fixed cap (enterprise). */
  seatLimit: number | null;
  /** Stripe price lookup_key; null for enterprise (sales-led). */
  lookupKey: string | null;
  blurb: string;
}

export const INSTITUTIONAL_TIERS: InstitutionalTier[] = [
  { id: "starter", label: "Starter", priceUsd: 49, seatLimit: 5, lookupKey: "tokeville_inst_starter", blurb: "Up to 5 active users" },
  { id: "team", label: "Team", priceUsd: 199, seatLimit: 25, lookupKey: "tokeville_inst_team", blurb: "Up to 25 active users" },
  { id: "scale", label: "Scale", priceUsd: 499, seatLimit: 100, lookupKey: "tokeville_inst_scale", blurb: "Up to 100 active users" },
  { id: "enterprise", label: "Enterprise", priceUsd: null, seatLimit: null, lookupKey: null, blurb: "100+ users — contact us" },
];

export function tierById(id: string | null | undefined): InstitutionalTier | null {
  return INSTITUTIONAL_TIERS.find((t) => t.id === id) ?? null;
}

/** The next tier up (for "upgrade to X" prompts); null when already at the top. */
export function nextTier(id: InstitutionalTierId): InstitutionalTier | null {
  const i = INSTITUTIONAL_TIERS.findIndex((t) => t.id === id);
  return i >= 0 && i < INSTITUTIONAL_TIERS.length - 1 ? INSTITUTIONAL_TIERS[i + 1] : null;
}

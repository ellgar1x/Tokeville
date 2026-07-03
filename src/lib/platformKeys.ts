/**
 * Tokeville's own funded API keys, one per provider — the reseller model.
 *
 * Team-tier chat routes through THESE keys, not customer-supplied ones. TOK
 * deposits are what back the real cost incurred here (see api/chat/route.ts
 * pre-flight balance checks + use_tokens deduction), so a workspace's TOK
 * balance is real purchasing power, not just an internal counter.
 *
 * Set PLATFORM_<PROVIDER>_API_KEY in the environment (server-only, never
 * NEXT_PUBLIC_). A provider with no key set simply isn't offered yet.
 */

export type PlatformProvider = "anthropic" | "openai" | "google";

const ENV_VAR: Record<PlatformProvider, string> = {
  anthropic: "PLATFORM_ANTHROPIC_API_KEY",
  openai: "PLATFORM_OPENAI_API_KEY",
  google: "PLATFORM_GOOGLE_API_KEY",
};

export function getPlatformKey(provider: string): { apiKey: string } | null {
  const envVar = ENV_VAR[provider as PlatformProvider];
  if (!envVar) return null;
  const apiKey = process.env[envVar];
  return apiKey ? { apiKey } : null;
}

/** Which providers Tokeville currently has a funded key for. */
export function configuredProviders(): PlatformProvider[] {
  return (Object.keys(ENV_VAR) as PlatformProvider[]).filter((p) => !!process.env[ENV_VAR[p]]);
}

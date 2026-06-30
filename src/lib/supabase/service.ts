import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client — bypasses RLS.
 * Only use this in server-side route handlers that authenticate via their own
 * mechanism (e.g. Stripe webhook signature verification). Never expose to the browser.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!key) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set. Add it to .env.local.");
  }
  return createSupabaseClient(url, key, {
    auth: { persistSession: false },
  });
}

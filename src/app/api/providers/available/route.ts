import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { configuredProviders } from "@/lib/platformKeys";

/**
 * Which providers Tokeville has a funded platform key for — global, not
 * workspace-scoped (the reseller model uses one pooled key per provider).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  return NextResponse.json({ providers: configuredProviders() });
}

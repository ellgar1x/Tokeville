import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { hashKey } from "@/lib/apiKeys";

/**
 * Per-admin Tokeville API keys (sk-tok-…). Each admin gets their OWN key; the
 * gateway (/api/gateway) authenticates with it and spends that workspace's
 * treasury. Only the SHA-256 hash is stored — the full key is returned once,
 * at creation, and never again.
 */

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", status: 401 as const };
  if (user.app_metadata?.role !== "admin") return { error: "Admin access required", status: 403 as const };
  const workspaceId = user.app_metadata?.workspace_id as string | undefined;
  if (!workspaceId) return { error: "No workspace", status: 403 as const };
  return { supabase, user, workspaceId };
}

export async function GET() {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const { data, error } = await auth.supabase
    .from("tokeville_keys")
    .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ keys: data });
}

export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body: { name?: string };
  try { body = await request.json(); } catch { body = {}; }
  const name = (body.name ?? "").trim().slice(0, 60) || "API key";

  // sk-tok-<40 hex>. Prefix (through the first 6 secret chars) is safe to display.
  const secret = randomBytes(20).toString("hex");
  const fullKey = `sk-tok-${secret}`;
  const keyPrefix = `sk-tok-${secret.slice(0, 6)}`;

  const { data, error } = await auth.supabase
    .from("tokeville_keys")
    .insert({
      workspace_id: auth.workspaceId,
      name,
      key_prefix: keyPrefix,
      key_hash: hashKey(fullKey),
      created_by: auth.user.id,
    })
    .select("id, name, key_prefix, created_at, last_used_at, revoked_at")
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // The only time the full key is ever returned.
  return NextResponse.json({ key: data, secret: fullKey });
}

export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await auth.supabase
    .from("tokeville_keys")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", auth.workspaceId)
    .is("revoked_at", null);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

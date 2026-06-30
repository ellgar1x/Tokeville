import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/crypto";

function requireAdmin(user: { app_metadata?: Record<string, unknown> }) {
  return user.app_metadata?.role === "admin";
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error("[provider-keys] GET: unauthenticated");
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const workspaceId = user.app_metadata?.workspace_id;
  if (!workspaceId) {
    console.error("[provider-keys] GET: no workspace_id", { userId: user.id });
    return NextResponse.json({ error: "No workspace" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("provider_api_keys")
    .select("id, provider, label, base_url, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at");

  if (error) {
    console.error("[provider-keys] GET: DB error", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ keys: data });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error("[provider-keys] POST: unauthenticated");
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireAdmin(user)) {
    console.error("[provider-keys] POST: non-admin attempted to add key", { userId: user.id });
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const workspaceId = user.app_metadata?.workspace_id;
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 });

  let body: { provider?: string; label?: string; apiKey?: string; baseUrl?: string };
  try { body = await request.json(); } catch {
    console.error("[provider-keys] POST: invalid JSON body");
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { provider, label, apiKey, baseUrl } = body;
  if (!provider || !label || !apiKey) {
    return NextResponse.json({ error: "provider, label, and apiKey are required" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("provider_api_keys")
    .insert({
      workspace_id: workspaceId,
      provider,
      label,
      api_key: encryptSecret(apiKey),
      base_url: baseUrl ?? null,
    })
    .select("id, provider, label, base_url, created_at")
    .single();

  if (error) {
    console.error("[provider-keys] POST: insert failed", { provider, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ key: data });
}

export async function DELETE(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error("[provider-keys] DELETE: unauthenticated");
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if (!requireAdmin(user)) {
    console.error("[provider-keys] DELETE: non-admin attempted to delete key", { userId: user.id });
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  const workspaceId = user.app_metadata?.workspace_id;
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { error } = await supabase
    .from("provider_api_keys")
    .delete()
    .eq("id", id)
    .eq("workspace_id", workspaceId);

  if (error) {
    console.error("[provider-keys] DELETE: DB error", { id, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret } from "@/lib/crypto";
import { tokensFromUsd } from "@/lib/format";

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

  // RLS returns the caller's own keys (any user) plus every workspace key (admins).
  const { data, error } = await supabase
    .from("provider_api_keys")
    .select("id, provider, label, base_url, budget_tokens, spent_tokens, owner_user_id, assigned_user_id, assigned_sub_account_id, created_at")
    .eq("workspace_id", workspaceId)
    .order("created_at");

  if (error) {
    console.error("[provider-keys] GET: DB error", { error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ keys: data, currentUserId: user.id });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.error("[provider-keys] POST: unauthenticated");
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Any authenticated user can add a key — it's owned by them (RLS enforces this).
  const workspaceId = user.app_metadata?.workspace_id;
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 });

  let body: { provider?: string; label?: string; apiKey?: string; baseUrl?: string; budgetUsd?: number };
  try { body = await request.json(); } catch {
    console.error("[provider-keys] POST: invalid JSON body");
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const { provider, label, apiKey, baseUrl, budgetUsd } = body;
  if (!provider || !label || !apiKey) {
    return NextResponse.json({ error: "provider, label, and apiKey are required" }, { status: 400 });
  }

  // Optional per-key budget, entered in USD and stored as TOK (null = no cap).
  const budgetTokens =
    typeof budgetUsd === "number" && budgetUsd > 0 ? Math.round(tokensFromUsd(budgetUsd)) : null;

  const { data, error } = await supabase
    .from("provider_api_keys")
    .insert({
      workspace_id: workspaceId,
      owner_user_id: user.id,
      provider,
      label,
      api_key: encryptSecret(apiKey),
      base_url: baseUrl ?? null,
      budget_tokens: budgetTokens,
    })
    .select("id, provider, label, base_url, budget_tokens, spent_tokens, owner_user_id, created_at")
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

  // RLS lets owners delete their own key and admins delete any workspace key.
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

// PATCH — edit a key's budget, reconcile its spend to the provider's actual
// remaining balance, and/or delegate it to a person or project. RLS restricts
// this to the key's owner (or a workspace admin).
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const workspaceId = user.app_metadata?.workspace_id;
  if (!workspaceId) return NextResponse.json({ error: "No workspace" }, { status: 403 });

  let body: {
    id?: string;
    budgetUsd?: number | null;
    remainingUsd?: number;
    /** Delegation: "user:<uuid>" | "project:<uuid>" | "shared" (clear). */
    assignTo?: string;
  };
  try { body = await request.json(); } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }
  const { id, budgetUsd, remainingUsd, assignTo } = body;
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const { data: key, error: kErr } = await supabase
    .from("provider_api_keys")
    .select("id, budget_tokens")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .single();
  if (kErr || !key) return NextResponse.json({ error: "Key not found" }, { status: 404 });

  const patch: Record<string, unknown> = {};
  let budgetTok: number | null = (key.budget_tokens as number | null) ?? null;

  if (budgetUsd !== undefined) {
    budgetTok = typeof budgetUsd === "number" && budgetUsd > 0 ? Math.round(tokensFromUsd(budgetUsd)) : null;
    patch.budget_tokens = budgetTok;
  }

  // "Reconcile": set spent so the remaining matches what the provider dashboard shows.
  if (typeof remainingUsd === "number") {
    if (budgetTok == null) {
      return NextResponse.json({ error: "Set a budget before reconciling a remaining balance." }, { status: 400 });
    }
    patch.spent_tokens = Math.max(0, budgetTok - Math.round(tokensFromUsd(remainingUsd)));
  }

  // Delegation — pin the key to one member or one project (or back to shared).
  // Targets are validated against the caller's workspace before writing.
  if (assignTo !== undefined) {
    if (assignTo === "shared") {
      patch.assigned_user_id = null;
      patch.assigned_sub_account_id = null;
    } else if (assignTo.startsWith("user:")) {
      const targetId = assignTo.slice(5);
      const { data: member } = await supabase
        .from("workspace_members")
        .select("user_id")
        .eq("workspace_id", workspaceId)
        .eq("user_id", targetId)
        .single();
      if (!member) return NextResponse.json({ error: "That person isn't in your workspace." }, { status: 400 });
      patch.assigned_user_id = targetId;
      patch.assigned_sub_account_id = null;
    } else if (assignTo.startsWith("project:")) {
      const targetId = assignTo.slice(8);
      const { data: acct } = await supabase
        .from("sub_accounts")
        .select("id")
        .eq("id", targetId)
        .eq("workspace_id", workspaceId)
        .single();
      if (!acct) return NextResponse.json({ error: "That project isn't in your workspace." }, { status: 400 });
      patch.assigned_sub_account_id = targetId;
      patch.assigned_user_id = null;
    } else {
      return NextResponse.json({ error: "assignTo must be 'shared', 'user:<id>', or 'project:<id>'" }, { status: 400 });
    }
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("provider_api_keys")
    .update(patch)
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .select("id, provider, label, base_url, budget_tokens, spent_tokens, owner_user_id, assigned_user_id, assigned_sub_account_id, created_at")
    .single();

  if (error) {
    console.error("[provider-keys] PATCH: DB error", { id, error: error.message });
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ key: data });
}

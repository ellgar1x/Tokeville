import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isValidUsername, normalizeUsername, usernameToEmail } from "@/lib/members";
import { nextTier, tierById, type InstitutionalTierId } from "@/lib/plans";

/**
 * Institutional per-seat enforcement: adding a NEW member is blocked once the
 * workspace's active users (members with >= 1 spend event this billing month)
 * have reached the tier's seat limit. Existing users are never blocked from
 * using the platform — only new additions are gated. Team workspaces and
 * tiers without a limit (enterprise / legacy subs) are unaffected.
 */
async function seatLimitError(
  supabase: Awaited<ReturnType<typeof createClient>>,
  workspaceId: string,
): Promise<string | null> {
  const { data: ws } = await supabase
    .from("workspaces")
    .select("type, institutional_tier, institutional_seat_limit")
    .eq("id", workspaceId)
    .single();
  if (!ws || ws.type !== "institution" || ws.institutional_seat_limit == null) return null;

  // Live count (not the cached column) so month boundaries are always correct.
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const { data: spenders } = await supabase
    .from("activity")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("type", "spend")
    .gte("created_at", monthStart.toISOString());
  const activeCount = new Set((spenders ?? []).map((r) => r.user_id as string)).size;

  const limit = Number(ws.institutional_seat_limit);
  if (activeCount < limit) return null;

  const tier = tierById(ws.institutional_tier);
  const up = tier ? nextTier(tier.id as InstitutionalTierId) : null;
  const tierName = tier?.label ?? "current";
  return up
    ? `You've reached your ${tierName} plan limit of ${limit} active users. Upgrade to ${up.label} to add more.`
    : `You've reached your ${tierName} plan limit of ${limit} active users. Contact us to raise it.`;
}

/** Authenticate the caller and confirm they are an admin of a workspace. */
async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated", status: 401 as const };
  if (user.app_metadata?.role !== "admin") {
    return { error: "Admin access required", status: 403 as const };
  }
  const workspaceId = user.app_metadata?.workspace_id as string | undefined;
  if (!workspaceId) return { error: "No workspace", status: 403 as const };
  return { user, workspaceId };
}

// POST — create a member account (username + password) in the admin's workspace.
export async function POST(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    console.error("[members] create denied", { error: auth.error });
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  // Institutional workspaces: block NEW members past the tier's seat limit.
  {
    const supabase = await createClient();
    const limitMsg = await seatLimitError(supabase, auth.workspaceId);
    if (limitMsg) {
      console.error("[members] seat limit reached", { workspaceId: auth.workspaceId });
      return NextResponse.json({ error: limitMsg, seatLimitReached: true }, { status: 402 });
    }
  }

  let body: {
    username?: string;
    password?: string;
    displayName?: string;
    subAccountId?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const username = normalizeUsername(body.username ?? "");
  const password = body.password ?? "";
  const displayName = (body.displayName ?? "").trim() || username;
  const subAccountId = body.subAccountId || null;

  if (!isValidUsername(username)) {
    return NextResponse.json(
      { error: "Username must be 3–30 characters: letters, numbers, dot, dash, underscore." },
      { status: 400 },
    );
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
  }

  // If a sub-account was chosen, verify it belongs to the admin's workspace (RLS-scoped).
  if (subAccountId) {
    const supabase = await createClient();
    const { data: acct, error: acctErr } = await supabase
      .from("sub_accounts").select("id").eq("id", subAccountId).single();
    if (acctErr || !acct) {
      return NextResponse.json({ error: "Project not found in your workspace" }, { status: 400 });
    }
  }

  const email = usernameToEmail(username);
  const service = createServiceClient();

  const { data: created, error: createErr } = await service.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { role: "member", workspace_id: auth.workspaceId },
    user_metadata: {
      display_name: displayName,
      username,
      provision_role: "member",
      provision_workspace_id: auth.workspaceId,
      sub_account_id: subAccountId ?? "",
    },
  });

  if (createErr || !created?.user) {
    const taken = createErr?.message?.toLowerCase().includes("already");
    console.error("[members] createUser failed", { error: createErr?.message, username });
    return NextResponse.json(
      { error: taken ? "That username is already taken." : (createErr?.message ?? "Could not create member") },
      { status: taken ? 409 : 502 },
    );
  }

  return NextResponse.json({
    member: {
      userId: created.user.id,
      username,
      displayName,
      subAccountId,
    },
  });
}

// DELETE — remove a member account by user id (must belong to the admin's workspace).
export async function DELETE(request: Request) {
  const auth = await requireAdmin();
  if ("error" in auth) {
    console.error("[members] delete denied", { error: auth.error });
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const userId = new URL(request.url).searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

  // Confirm the target is a member of THIS admin's workspace before deleting.
  const supabase = await createClient();
  const { data: member, error: memberErr } = await supabase
    .from("workspace_members")
    .select("user_id, role")
    .eq("user_id", userId)
    .eq("workspace_id", auth.workspaceId)
    .single();

  if (memberErr || !member || member.role !== "member") {
    return NextResponse.json({ error: "Member not found in your workspace" }, { status: 404 });
  }

  const service = createServiceClient();
  const { error: delErr } = await service.auth.admin.deleteUser(userId);
  if (delErr) {
    console.error("[members] deleteUser failed", { error: delErr.message, userId });
    return NextResponse.json({ error: delErr.message }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}

import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isValidUsername, normalizeUsername, usernameToEmail } from "@/lib/members";

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

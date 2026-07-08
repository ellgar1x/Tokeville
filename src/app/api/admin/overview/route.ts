import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { isSuperAdmin } from "@/lib/superAdmin";

/**
 * Internal console data — the waitlist + every admin account across all
 * workspaces. Super-admin only; uses the service client to read across tenants
 * (RLS would otherwise scope the caller to their own workspace).
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  if (!isSuperAdmin(user.email)) return NextResponse.json({ error: "Not authorized" }, { status: 403 });

  const service = createServiceClient();

  const [waitlistRes, membersRes, wsRes] = await Promise.all([
    service.from("waitlist").select("id, email, name, company, created_at").order("created_at", { ascending: false }),
    service.from("workspace_members").select("user_id, workspace_id, display_name, email, created_at").eq("role", "admin"),
    service.from("workspaces").select("id, name, type, subscription_status, institutional_tier, created_at"),
  ]);

  const wsById = new Map((wsRes.data ?? []).map((w) => [w.id as string, w]));
  const admins = (membersRes.data ?? [])
    .map((m) => {
      const ws = wsById.get(m.workspace_id as string);
      return {
        email: m.email as string,
        displayName: (m.display_name as string) ?? "",
        workspaceName: (ws?.name as string) ?? "—",
        workspaceType: (ws?.type as string) ?? "team",
        subscriptionStatus: (ws?.subscription_status as string) ?? null,
        institutionalTier: (ws?.institutional_tier as string) ?? null,
        createdAt: (m.created_at as string) ?? (ws?.created_at as string) ?? null,
      };
    })
    .sort((a, b) => (b.createdAt ?? "").localeCompare(a.createdAt ?? ""));

  return NextResponse.json({
    waitlist: waitlistRes.data ?? [],
    admins,
    counts: { waitlist: (waitlistRes.data ?? []).length, admins: admins.length },
  });
}

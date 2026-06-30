import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadDashboard, loadMemberDashboard } from "@/lib/db";
import { AppShell } from "@/components/AppShell";
import { MemberShell } from "@/components/MemberShell";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const role = (user.app_metadata?.role as string) ?? "admin";

  if (role === "member") {
    const data = await loadMemberDashboard(supabase, user.email ?? "");
    const workspaceId = (user.app_metadata?.workspace_id as string) ?? "";
    return (
      <MemberShell initial={data} userId={user.id} workspaceId={workspaceId}>
        {children}
      </MemberShell>
    );
  }

  const data = await loadDashboard(supabase, user.email ?? "");
  return (
    <AppShell initial={data} userId={user.id} workspaceId={data.workspace.id}>
      {children}
    </AppShell>
  );
}

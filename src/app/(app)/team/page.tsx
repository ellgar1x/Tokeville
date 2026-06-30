"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDemo } from "@/store/demo";
import { createClient } from "@/lib/supabase/client";
import { pct, tok, usdFromTokens, usd } from "@/lib/format";
import { CheckIcon, CloseIcon, PlusIcon, SendIcon, UsersIcon } from "@/components/icons";

interface MemberRow {
  id: string;
  user_id: string | null;
  role: string;
  display_name: string;
  email: string;
}
interface InviteRow {
  id: string;
  email: string;
  sub_account_id: string | null;
  status: string;
}
interface ProjectMemberRow {
  id: string;
  user_id: string;
  sub_account_id: string;
}
interface RequestRow {
  id: string;
  sub_account_id: string;
  member_id: string;
  amount_tokens: number;
  message: string;
  status: string;
  admin_response: string;
}

export default function TeamPage() {
  const { state, invite, assignProject, unassignProject, resolveRequest } = useDemo();
  const supabase = useMemo(() => createClient(), []);
  const workspaceId = state.workspace.id;

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMemberRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);

  const [email, setEmail] = useState("");
  const [accountId, setAccountId] = useState(state.accounts[0]?.id ?? "");
  const [sending, setSending] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [responses, setResponses] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const [m, i, pm, r] = await Promise.all([
      supabase.from("workspace_members").select("*"),
      supabase.from("invites").select("*").eq("status", "pending"),
      supabase.from("project_members").select("*"),
      supabase.from("budget_requests").select("*").order("created_at", { ascending: false }),
    ]);
    setMembers((m.data as MemberRow[]) ?? []);
    setInvites((i.data as InviteRow[]) ?? []);
    setProjectMembers((pm.data as ProjectMemberRow[]) ?? []);
    setRequests((r.data as RequestRow[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel(`team-${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_members", filter: `workspace_id=eq.${workspaceId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "invites", filter: `workspace_id=eq.${workspaceId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "project_members", filter: `workspace_id=eq.${workspaceId}` }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "budget_requests", filter: `workspace_id=eq.${workspaceId}` }, refresh)
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [supabase, workspaceId, refresh]);

  const accountName = (id: string | null) =>
    state.accounts.find((a) => a.id === id)?.name ?? "—";
  const memberName = (id: string) =>
    members.find((m) => m.user_id === id)?.display_name || "Member";
  const projectsFor = (userId: string | null) =>
    userId ? projectMembers.filter((pm) => pm.user_id === userId) : [];

  const pendingRequests = requests.filter((r) => r.status === "pending");

  async function send() {
    if (!email.trim() || !accountId) return;
    setSending(true);
    const ok = await invite(email.trim(), accountId);
    setSending(false);
    if (ok) {
      setLastLink(`${location.origin}/login?email=${encodeURIComponent(email.trim())}`);
      setCopied(false);
      setEmail("");
      refresh();
    }
  }

  const inputClass =
    "h-10 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm outline-none transition-colors duration-200 placeholder:text-subtle focus:border-gold/50 focus:ring-2 focus:ring-gold/15";

  return (
    <div className="space-y-6">
      {/* Pending budget requests */}
      {pendingRequests.length > 0 && (
        <section className="rounded-2xl border border-gold/30 bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
          <div className="flex items-center gap-2 px-6 py-5">
            <SendIcon className="h-4 w-4 text-gold" />
            <h2 className="text-sm font-semibold tracking-tight">Budget requests</h2>
            <span className="rounded-full bg-gold-soft px-2 py-0.5 text-[10px] font-medium text-gold">
              {pendingRequests.length} pending
            </span>
          </div>
          <ul className="border-t border-border">
            {pendingRequests.map((r) => (
              <li key={r.id} className="border-b border-border px-6 py-4 last:border-b-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {memberName(r.member_id)} · {accountName(r.sub_account_id)}
                    </p>
                    <p className="tnum text-xs text-muted">
                      Requesting <span className="font-mono text-gold">{tok(r.amount_tokens)}</span>{" "}
                      (≈ {usd(usdFromTokens(r.amount_tokens))})
                    </p>
                    {r.message && <p className="mt-1 text-xs text-muted">“{r.message}”</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={responses[r.id] ?? ""}
                      onChange={(e) => setResponses({ ...responses, [r.id]: e.target.value })}
                      placeholder="Reply (optional)"
                      className="h-9 w-40 rounded-lg border border-border-strong bg-surface px-3 text-xs outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/15"
                    />
                    <button
                      onClick={() => resolveRequest(r.id, true, responses[r.id] ?? "")}
                      className="inline-flex h-9 items-center gap-1 rounded-lg bg-gradient-to-b from-gold-bright to-gold px-3 text-xs font-semibold text-[#0a0a0b] hover:from-gold hover:to-gold-deep cursor-pointer"
                    >
                      <CheckIcon className="h-3.5 w-3.5" /> Approve
                    </button>
                    <button
                      onClick={() => resolveRequest(r.id, false, responses[r.id] ?? "")}
                      className="inline-flex h-9 items-center gap-1 rounded-lg border border-border-strong bg-surface px-3 text-xs font-medium text-muted hover:border-danger/40 hover:text-danger cursor-pointer"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Invite */}
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)] sm:p-7">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <SendIcon className="h-4 w-4 text-gold" />
          Invite a member
        </h2>
        <p className="mt-0.5 text-xs text-subtle">
          They’ll sign up and land on a member dashboard scoped to their projects
        </p>

        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="member@company.com"
              className={inputClass}
            />
          </div>
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">
              First project
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={`${inputClass} cursor-pointer`}
            >
              {state.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.type}
                </option>
              ))}
            </select>
          </div>
          <button
            onClick={send}
            disabled={sending || !email.trim()}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-gold-bright to-gold px-4 text-sm font-semibold text-[#0a0a0b] shadow-[0_1px_8px_rgba(232,184,95,0.25)] transition-all duration-200 hover:from-gold hover:to-gold-deep disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            <PlusIcon className="h-4 w-4" />
            Invite
          </button>
        </div>

        {lastLink && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-gold/20 bg-gold-soft p-3">
            <span className="text-xs text-muted">Invite link</span>
            <code className="tnum flex-1 truncate font-mono text-xs text-gold">{lastLink}</code>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(lastLink);
                  setCopied(true);
                } catch {
                  /* ignore */
                }
              }}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-gold/30 bg-surface px-3 text-xs font-medium text-gold hover:bg-surface-2 cursor-pointer"
            >
              {copied ? <CheckIcon className="h-3.5 w-3.5" /> : null}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        )}
      </section>

      {/* Members + their projects */}
      <section className="rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
        <div className="flex items-center gap-2 px-6 py-5">
          <UsersIcon className="h-4 w-4 text-gold" />
          <h2 className="text-sm font-semibold tracking-tight">Members</h2>
          <span className="text-xs text-subtle">({members.length})</span>
        </div>
        <ul className="border-t border-border">
          {members.map((m) => {
            const myProjects = projectsFor(m.user_id);
            const myIds = myProjects.map((p) => p.sub_account_id);
            const available = state.accounts.filter((a) => !myIds.includes(a.id));
            return (
              <li key={m.id} className="border-b border-border px-6 py-4 last:border-b-0">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{m.display_name || "—"}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${m.role === "admin" ? "bg-gold-soft text-gold" : "bg-surface-2 text-muted"}`}
                      >
                        {m.role}
                      </span>
                    </div>
                    <p className="text-xs text-subtle">{m.email}</p>
                  </div>
                  {m.role === "member" && available.length > 0 && (
                    <AddProject
                      accounts={available}
                      onAdd={(sid) => m.user_id && assignProject(m.user_id, sid)}
                    />
                  )}
                </div>

                {m.role === "admin" ? (
                  <p className="mt-2 text-xs text-subtle">Full access · all projects</p>
                ) : (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {myProjects.length === 0 && (
                      <span className="text-xs text-subtle">No projects assigned</span>
                    )}
                    {myProjects.map((pm) => {
                      const acc = state.accounts.find((a) => a.id === pm.sub_account_id);
                      const used = acc ? (acc.tokensUsed / acc.tokenBudget) * 100 : 0;
                      return (
                        <span
                          key={pm.id}
                          className="inline-flex items-center gap-2 rounded-full border border-border bg-surface-2 py-1 pl-3 pr-1.5 text-xs"
                        >
                          <span className="font-medium">{accountName(pm.sub_account_id)}</span>
                          {acc && (
                            <span className="tnum text-subtle">
                              {tok(acc.tokensUsed)} · {pct(used)}
                            </span>
                          )}
                          <button
                            onClick={() => m.user_id && unassignProject(m.user_id, pm.sub_account_id)}
                            aria-label="Remove from project"
                            className="flex h-4 w-4 items-center justify-center rounded-full text-subtle hover:bg-danger/15 hover:text-danger cursor-pointer"
                          >
                            <CloseIcon className="h-3 w-3" />
                          </button>
                        </span>
                      );
                    })}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {/* Pending invites */}
      {invites.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
          <div className="px-6 py-5">
            <h2 className="text-sm font-semibold tracking-tight">Pending invites</h2>
          </div>
          <ul className="border-t border-border">
            {invites.map((i) => (
              <li
                key={i.id}
                className="flex items-center justify-between gap-3 border-b border-border px-6 py-3.5 last:border-b-0"
              >
                <div>
                  <p className="text-sm font-medium">{i.email}</p>
                  <p className="text-xs text-subtle">First project: {accountName(i.sub_account_id)}</p>
                </div>
                <span className="rounded-full border border-warning/30 bg-warning-soft px-2 py-0.5 text-[10px] font-medium text-warning">
                  Pending
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function AddProject({
  accounts,
  onAdd,
}: {
  accounts: { id: string; name: string; type: string }[];
  onAdd: (subAccountId: string) => void;
}) {
  const [sid, setSid] = useState(accounts[0]?.id ?? "");
  return (
    <div className="flex items-center gap-2">
      <select
        value={sid}
        onChange={(e) => setSid(e.target.value)}
        className="h-8 rounded-lg border border-border-strong bg-surface px-2 text-xs outline-none focus:border-gold/50 cursor-pointer"
      >
        {accounts.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name}
          </option>
        ))}
      </select>
      <button
        onClick={() => sid && onAdd(sid)}
        className="inline-flex h-8 items-center gap-1 rounded-lg border border-border-strong bg-surface-2 px-2.5 text-xs font-medium text-muted hover:border-gold/40 hover:text-gold cursor-pointer"
      >
        <PlusIcon className="h-3.5 w-3.5" /> Add to project
      </button>
    </div>
  );
}

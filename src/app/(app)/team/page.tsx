"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useDemo } from "@/store/demo";
import { createClient } from "@/lib/supabase/client";
import { pct, tok, usdFromTokens, usd } from "@/lib/format";
import { CheckIcon, CloseIcon, PlusIcon, SendIcon, UsersIcon } from "@/components/icons";
import { emailToUsername } from "@/lib/members";

interface MemberRow {
  id: string;
  user_id: string | null;
  role: string;
  display_name: string;
  email: string;
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
  const { state, assignProject, unassignProject, resolveRequest } = useDemo();
  const supabase = useMemo(() => createClient(), []);
  const workspaceId = state.workspace.id;

  const [members, setMembers] = useState<MemberRow[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMemberRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);

  const [username, setUsername] = useState("");
  const [memberPassword, setMemberPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [accountId, setAccountId] = useState(state.accounts[0]?.id ?? "");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createdCred, setCreatedCred] = useState<{ username: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [responses, setResponses] = useState<Record<string, string>>({});

  const refresh = useCallback(async () => {
    const [m, pm, r] = await Promise.all([
      supabase.from("workspace_members").select("*"),
      supabase.from("project_members").select("*"),
      supabase.from("budget_requests").select("*").order("created_at", { ascending: false }),
    ]);
    setMembers((m.data as MemberRow[]) ?? []);
    setProjectMembers((pm.data as ProjectMemberRow[]) ?? []);
    setRequests((r.data as RequestRow[]) ?? []);
  }, [supabase]);

  useEffect(() => {
    refresh();
    const channel = supabase
      .channel(`team-${workspaceId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "workspace_members", filter: `workspace_id=eq.${workspaceId}` }, refresh)
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

  function generatePassword() {
    const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const bytes = crypto.getRandomValues(new Uint8Array(14));
    setMemberPassword(Array.from(bytes, (b) => chars[b % chars.length]).join(""));
  }

  async function createMember() {
    setCreateError(null);
    const u = username.trim();
    if (!u || memberPassword.length < 6) {
      setCreateError("Enter a username and a password of at least 6 characters.");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: u,
          password: memberPassword,
          displayName: displayName.trim() || u,
          subAccountId: accountId || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not create member");
      setCreatedCred({ username: data.member.username, password: memberPassword });
      setCopied(false);
      setUsername("");
      setMemberPassword("");
      setDisplayName("");
      refresh();
    } catch (e) {
      setCreateError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setCreating(false);
    }
  }

  async function removeMember(userId: string) {
    const res = await fetch(`/api/members?userId=${userId}`, { method: "DELETE" });
    if (res.ok) refresh();
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

      {/* Create member account */}
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)] sm:p-7">
        <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
          <PlusIcon className="h-4 w-4 text-gold" />
          Create a member account
        </h2>
        <p className="mt-0.5 text-xs text-subtle">
          Set a username and password. Members sign in on the “Member” tab and land on a
          dashboard scoped to their projects — they can’t create their own account.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">
              Username
            </label>
            <input
              value={username}
              onChange={(e) => { setUsername(e.target.value); setCreateError(null); }}
              placeholder="taylor.r"
              autoCapitalize="none"
              className={`${inputClass} font-mono`}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">
              Display name
            </label>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Taylor Rivera"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">
              Password
            </label>
            <div className="flex gap-2">
              <input
                value={memberPassword}
                onChange={(e) => { setMemberPassword(e.target.value); setCreateError(null); }}
                placeholder="At least 6 characters"
                className={`${inputClass} font-mono`}
              />
              <button
                type="button"
                onClick={generatePassword}
                className="shrink-0 rounded-lg border border-border-strong bg-surface-2 px-3 text-xs font-medium text-muted transition-colors hover:border-gold/40 hover:text-gold cursor-pointer"
              >
                Generate
              </button>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">
              First project
            </label>
            <select
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
              className={`${inputClass} cursor-pointer`}
            >
              <option value="">No project yet</option>
              {state.accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} · {a.type}
                </option>
              ))}
            </select>
          </div>
        </div>

        {createError && (
          <p className="mt-3 rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
            {createError}
          </p>
        )}

        <div className="mt-4">
          <button
            onClick={createMember}
            disabled={creating || !username.trim() || memberPassword.length < 6}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-gold-bright to-gold px-4 text-sm font-semibold text-[#0a0a0b] shadow-[0_1px_8px_rgba(232,184,95,0.25)] transition-all duration-200 hover:from-gold hover:to-gold-deep disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            <PlusIcon className="h-4 w-4" />
            {creating ? "Creating…" : "Create account"}
          </button>
        </div>

        {createdCred && (
          <div className="mt-4 rounded-lg border border-gold/20 bg-gold-soft p-3">
            <p className="text-xs font-medium text-gold">Account created — share these credentials securely</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-xs">
              <span className="text-muted">user <span className="text-foreground">{createdCred.username}</span></span>
              <span className="text-muted">pass <span className="text-foreground">{createdCred.password}</span></span>
              <button
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(`username: ${createdCred.username}\npassword: ${createdCred.password}`);
                    setCopied(true);
                  } catch { /* ignore */ }
                }}
                className="inline-flex h-7 items-center gap-1 rounded-lg border border-gold/30 bg-surface px-2.5 font-sans text-xs font-medium text-gold hover:bg-surface-2 cursor-pointer"
              >
                {copied ? <CheckIcon className="h-3.5 w-3.5" /> : null}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="mt-2 text-[11px] text-subtle">
              The password won’t be shown again. You can always create a new account if it’s lost.
            </p>
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
                    <p className="text-xs text-subtle">
                      {m.role === "member" ? (
                        <span className="font-mono">@{emailToUsername(m.email)}</span>
                      ) : (
                        m.email
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.role === "member" && available.length > 0 && (
                      <AddProject
                        accounts={available}
                        onAdd={(sid) => m.user_id && assignProject(m.user_id, sid)}
                      />
                    )}
                    {m.role === "member" && m.user_id && (
                      <button
                        onClick={() => removeMember(m.user_id!)}
                        className="inline-flex h-8 items-center rounded-lg border border-border-strong bg-surface-2 px-2.5 text-xs font-medium text-muted transition-colors hover:border-danger/40 hover:text-danger cursor-pointer"
                      >
                        Remove
                      </button>
                    )}
                  </div>
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

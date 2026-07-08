"use client";

import { useEffect, useState } from "react";

interface WaitlistRow { id: string; email: string; name: string | null; company: string | null; created_at: string }
interface AdminRow {
  email: string; displayName: string; workspaceName: string; workspaceType: string;
  subscriptionStatus: string | null; institutionalTier: string | null; createdAt: string | null;
}

export default function AdminConsolePage() {
  const [data, setData] = useState<{ waitlist: WaitlistRow[]; admins: AdminRow[]; counts: { waitlist: number; admins: number } } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"waitlist" | "admins">("waitlist");

  useEffect(() => {
    fetch("/api/admin/overview")
      .then(async (r) => {
        if (r.status === 403) throw new Error("You don't have access to the console.");
        if (!r.ok) throw new Error("Couldn't load the console.");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e instanceof Error ? e.message : "Error"))
      .finally(() => setLoading(false));
  }, []);

  const fmtDate = (s: string | null) => (s ? new Date(s).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "—");

  function exportWaitlistCsv() {
    if (!data) return;
    const rows = [["email", "name", "company", "joined"], ...data.waitlist.map((w) => [w.email, w.name ?? "", w.company ?? "", w.created_at])];
    const csv = rows.map((r) => r.map((c) => (/[",\n]/.test(c) ? `"${c.replace(/"/g, '""')}"` : c)).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url; a.download = "tokeville-waitlist.csv"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Console</h1>
        <p className="mt-1 text-sm text-subtle">Waitlist signups and every admin account on Tokeville. Owner-only.</p>
      </div>

      {loading ? (
        <p className="text-sm text-subtle">Loading…</p>
      ) : error ? (
        <div className="rounded-2xl border border-danger/25 bg-danger-soft p-6 text-sm font-medium text-danger">{error}</div>
      ) : data ? (
        <>
          <nav className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface-2 p-1">
            {([["waitlist", `Waitlist · ${data.counts.waitlist}`], ["admins", `Admin accounts · ${data.counts.admins}`]] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer ${tab === id ? "bg-surface text-foreground shadow-sm border border-border" : "text-muted hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </nav>

          {tab === "waitlist" ? (
            <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
              <div className="flex items-center justify-between gap-3 border-b border-border px-6 py-4">
                <h2 className="text-sm font-semibold">Waiting list</h2>
                {data.waitlist.length > 0 && (
                  <button onClick={exportWaitlistCsv} className="h-8 rounded-lg border border-border-strong bg-surface-2 px-3 text-xs font-medium text-muted transition-colors hover:border-gold/40 hover:text-gold cursor-pointer">Export CSV</button>
                )}
              </div>
              {data.waitlist.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-subtle">No signups yet.</p>
              ) : (
                <div className="scroll-thin overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-subtle">
                        <th className="px-6 py-2.5 font-medium">Email</th>
                        <th className="px-6 py-2.5 font-medium">Name</th>
                        <th className="px-6 py-2.5 font-medium">Company</th>
                        <th className="px-6 py-2.5 font-medium">Joined</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.waitlist.map((w) => (
                        <tr key={w.id} className="border-b border-border/60 last:border-b-0 hover:bg-surface-2">
                          <td className="px-6 py-3 font-medium">{w.email}</td>
                          <td className="px-6 py-3 text-muted">{w.name ?? "—"}</td>
                          <td className="px-6 py-3 text-muted">{w.company ?? "—"}</td>
                          <td className="px-6 py-3 text-subtle">{fmtDate(w.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : (
            <section className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
              <div className="border-b border-border px-6 py-4">
                <h2 className="text-sm font-semibold">Admin accounts</h2>
              </div>
              {data.admins.length === 0 ? (
                <p className="px-6 py-10 text-center text-sm text-subtle">No admin accounts.</p>
              ) : (
                <div className="scroll-thin overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-subtle">
                        <th className="px-6 py-2.5 font-medium">Email</th>
                        <th className="px-6 py-2.5 font-medium">Workspace</th>
                        <th className="px-6 py-2.5 font-medium">Type</th>
                        <th className="px-6 py-2.5 font-medium">Plan</th>
                        <th className="px-6 py-2.5 font-medium">Created</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.admins.map((a, i) => (
                        <tr key={`${a.email}-${i}`} className="border-b border-border/60 last:border-b-0 hover:bg-surface-2">
                          <td className="px-6 py-3 font-medium">{a.email}</td>
                          <td className="px-6 py-3 text-muted">{a.workspaceName}</td>
                          <td className="px-6 py-3">
                            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${a.workspaceType === "institution" ? "bg-gold-soft text-gold" : "bg-surface-2 text-muted"}`}>
                              {a.workspaceType === "institution" ? "Institutional" : "Managed"}
                            </span>
                          </td>
                          <td className="px-6 py-3 text-muted">
                            {a.workspaceType === "institution"
                              ? (a.subscriptionStatus === "active" ? (a.institutionalTier ?? "subscribed") : (a.subscriptionStatus ?? "inactive"))
                              : "Pay-as-you-go"}
                          </td>
                          <td className="px-6 py-3 text-subtle">{fmtDate(a.createdAt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}

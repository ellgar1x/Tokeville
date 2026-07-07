"use client";

import { useEffect, useMemo, useState } from "react";
import { useInstitution, type SpendInput } from "@/store/institution";
import { usd } from "@/lib/format";
import type { Department, SpendEntry } from "@/lib/data";
import { INSTITUTIONAL_TIERS, tierById, type InstitutionalTierId } from "@/lib/plans";
import { ChatWorkspace } from "@/components/ChatWorkspace";
import { InstitutionKeys } from "@/components/InstitutionKeys";

type Tab = "overview" | "departments" | "chat" | "keys" | "spend" | "import" | "account";

const TABS: { id: Tab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "departments", label: "Departments" },
  { id: "chat", label: "Chat" },
  { id: "keys", label: "AI Keys" },
  { id: "spend", label: "Log spend" },
  { id: "import", label: "Import CSV" },
  { id: "account", label: "Account" },
];

const MONTH_KEY = new Date().toISOString().slice(0, 7); // YYYY-MM
const inputClass =
  "h-10 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm outline-none transition-colors duration-200 placeholder:text-subtle focus:border-gold/50 focus:ring-2 focus:ring-gold/15";

export default function InstitutionPage() {
  const [tab, setTab] = useState<Tab>("overview");
  const { state } = useInstitution();

  // The Institutional plan is subscription-gated: no active subscription → paywall.
  if (state.subscriptionStatus !== "active") {
    return <Paywall />;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">AI Spend Console</h1>
          <p className="mt-1 text-sm text-subtle">
            Track AI spend across every tool by department — logged manually or imported, in USD.
          </p>
        </div>
        <PlanBadge />
      </div>

      <nav className="flex flex-wrap gap-1 rounded-xl border border-border bg-surface-2 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 cursor-pointer ${
              tab === t.id
                ? "bg-surface text-foreground shadow-sm border border-border"
                : "text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "overview" && <Overview />}
      {tab === "departments" && <Departments />}
      {tab === "chat" && <ChatTab />}
      {tab === "keys" && <KeysTab />}
      {tab === "spend" && <LogSpend />}
      {tab === "import" && <ImportCsv />}
      {tab === "account" && <Account />}
    </div>
  );
}

/** Header chip: "Institutional · Team plan · 11/25 active users". */
function PlanBadge() {
  const { state } = useInstitution();
  const tier = tierById(state.institutionalTier);
  const seats = state.institutionalSeatLimit != null
    ? `${state.activeUserCount}/${state.institutionalSeatLimit} active users`
    : `${state.activeUserCount} active user${state.activeUserCount === 1 ? "" : "s"}`;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/30 bg-gold-soft px-3 py-1.5 text-xs font-medium text-gold">
      Institutional · {tier ? `${tier.label} plan` : "Legacy plan"} ·{" "}
      <span className="tnum font-mono">{seats}</span>
    </span>
  );
}

function Paywall() {
  const { state, subscribe, setWorkspaceType } = useInstitution();
  const [loading, setLoading] = useState(false);
  const [chosen, setChosen] = useState<InstitutionalTierId>("starter");
  const canceled = state.subscriptionStatus === "canceled";

  const perks = [
    "Consolidated USD dashboard across every AI tool",
    "Monthly budgets per department or team",
    "Manual spend logging + CSV import",
    "Automatic alerts when a department hits 80% of budget",
  ];
  const picked = tierById(chosen);

  return (
    <div className="mx-auto max-w-xl py-6">
      <div className="rounded-2xl border border-gold/25 bg-surface p-8 text-center shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
        <span className="inline-flex items-center rounded-full border border-gold/30 bg-gold-soft px-2.5 py-1 text-[11px] font-medium text-gold">
          Institutional plan
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight">
          {canceled ? "Your subscription has ended" : "Pick your plan"}
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
          Tokeville Institutional is for organizations with their own or contracted AI. Budget and
          track that spend by department — billing scales with your active users.
        </p>

        {/* Tier picker */}
        <div className="mt-6 grid gap-2 text-left">
          {INSTITUTIONAL_TIERS.map((t) =>
            t.priceUsd != null ? (
              <button
                key={t.id}
                onClick={() => setChosen(t.id)}
                className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-colors cursor-pointer ${
                  chosen === t.id ? "border-gold/60 bg-gold-soft" : "border-border bg-surface-2 hover:border-gold/30"
                }`}
              >
                <span>
                  <span className="text-sm font-semibold">{t.label}</span>
                  <span className="ml-2 text-xs text-subtle">{t.blurb}</span>
                </span>
                <span className="tnum font-mono text-sm font-bold text-gold">${t.priceUsd}<span className="text-xs font-normal text-subtle">/mo</span></span>
              </button>
            ) : (
              <a
                key={t.id}
                href={`mailto:sales@tokeville.app?subject=Tokeville%20Institutional%20Enterprise`}
                className="flex items-center justify-between rounded-xl border border-dashed border-border px-4 py-3 transition-colors hover:border-gold/30 cursor-pointer"
              >
                <span>
                  <span className="text-sm font-semibold">{t.label}</span>
                  <span className="ml-2 text-xs text-subtle">{t.blurb}</span>
                </span>
                <span className="text-xs font-medium text-gold">Contact us →</span>
              </a>
            ),
          )}
        </div>

        <ul className="mx-auto mt-6 max-w-sm space-y-2 text-left">
          {perks.map((p) => (
            <li key={p} className="flex items-start gap-2.5 text-sm">
              <CheckMini className="mt-0.5 h-4 w-4 shrink-0 text-gold" />
              <span className="text-muted">{p}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={() => { setLoading(true); subscribe(chosen); }}
          disabled={loading}
          className="mt-7 inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-gold-bright to-gold text-sm font-bold text-[#0a0a0b] shadow-[0_1px_12px_rgba(232,184,95,0.3)] transition-all duration-200 hover:from-gold hover:to-gold-deep disabled:opacity-50 cursor-pointer"
        >
          {loading ? "Redirecting to Stripe…" : `Subscribe · ${picked?.label} · $${picked?.priceUsd}/mo`}
        </button>
        <p className="mt-2.5 text-[11px] text-subtle">
          Secured by Stripe · test mode · card <span className="tnum font-mono">4242 4242 4242 4242</span>
        </p>

        <button
          onClick={() => setWorkspaceType("team")}
          className="mt-5 text-xs font-medium text-subtle transition-colors hover:text-gold cursor-pointer"
        >
          Not contracted AI? Switch to the Managed plan instead →
        </button>
      </div>
    </div>
  );
}

function CheckMini(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...props}>
      <path d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  );
}

/** Month-to-date spend per department id. */
function useMonthSpend() {
  const { state } = useInstitution();
  return useMemo(() => {
    const byDept = new Map<string, number>();
    const byTool = new Map<string, number>();
    let total = 0;
    for (const e of state.spend) {
      if (e.spentOn.slice(0, 7) !== MONTH_KEY) continue;
      byDept.set(e.departmentId, (byDept.get(e.departmentId) ?? 0) + e.amountUsd);
      byTool.set(e.tool, (byTool.get(e.tool) ?? 0) + e.amountUsd);
      total += e.amountUsd;
    }
    return { byDept, byTool, total };
  }, [state.spend]);
}

function budgetTone(ratio: number) {
  if (ratio >= 1) return { bar: "bg-danger", text: "text-danger" };
  if (ratio >= 0.8) return { bar: "bg-warning", text: "text-warning" };
  return { bar: "bg-gold", text: "text-muted" };
}

function Overview() {
  const { state } = useInstitution();
  const { byDept, byTool, total } = useMonthSpend();
  const totalBudget = state.departments.reduce((s, d) => s + d.monthlyBudgetUsd, 0);
  const tools = [...byTool.entries()].sort((a, b) => b[1] - a[1]);
  const monthLabel = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });

  if (state.departments.length === 0) {
    return (
      <Empty
        title="No departments yet"
        body="Add a department with a monthly budget, then log or import spend to see your consolidated dashboard."
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Kpi label={`Total spend · ${monthLabel}`} value={usd(total, { cents: true })} accent />
        <Kpi label="Monthly budget" value={usd(totalBudget, { cents: true })} />
        <Kpi
          label="Remaining"
          value={usd(Math.max(totalBudget - total, 0), { cents: true })}
          sub={totalBudget > 0 ? `${Math.round((total / totalBudget) * 100)}% used` : undefined}
        />
      </div>

      {/* Per-department budget bars */}
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
        <h2 className="text-sm font-semibold tracking-tight">Spend by department</h2>
        <div className="mt-4 space-y-4">
          {state.departments.map((d) => {
            const spent = byDept.get(d.id) ?? 0;
            const ratio = d.monthlyBudgetUsd > 0 ? spent / d.monthlyBudgetUsd : 0;
            const tone = budgetTone(ratio);
            return (
              <div key={d.id}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-medium">{d.name}</span>
                  <span className={`tnum font-mono text-xs ${tone.text}`}>
                    {usd(spent, { cents: true })} / {usd(d.monthlyBudgetUsd, { cents: true })}
                    {d.monthlyBudgetUsd > 0 && <> · {Math.round(ratio * 100)}%</>}
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                  <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(ratio * 100, 100)}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* By tool */}
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
        <h2 className="text-sm font-semibold tracking-tight">Spend by tool</h2>
        {tools.length === 0 ? (
          <p className="mt-3 text-sm text-subtle">No spend logged this month yet.</p>
        ) : (
          <ul className="mt-4 space-y-2.5">
            {tools.map(([tool, amt]) => (
              <li key={tool} className="flex items-center gap-3">
                <span className="w-40 shrink-0 truncate text-sm">{tool}</span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full rounded-full bg-gold" style={{ width: `${total > 0 ? (amt / total) * 100 : 0}%` }} />
                </div>
                <span className="tnum w-20 shrink-0 text-right font-mono text-xs text-muted">{usd(amt, { cents: true })}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Departments() {
  const { state, addDepartment, updateDepartment, deleteDepartment } = useInstitution();
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");

  async function add() {
    const b = parseFloat(budget);
    if (!name.trim() || isNaN(b) || b < 0) return;
    await addDepartment(name.trim(), b);
    setName("");
    setBudget("");
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
        <h2 className="text-sm font-semibold tracking-tight">Add a department</h2>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">Name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Engineering" className={inputClass} />
          </div>
          <div className="sm:w-48">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">Monthly budget (USD)</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">$</span>
              <input value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="5000" inputMode="decimal" className={`${inputClass} pl-7 font-mono`} />
            </div>
          </div>
          <button
            onClick={add}
            disabled={!name.trim() || !budget}
            className="inline-flex h-10 items-center justify-center rounded-lg bg-gradient-to-b from-gold-bright to-gold px-4 text-sm font-semibold text-[#0a0a0b] shadow-[0_1px_8px_rgba(232,184,95,0.25)] transition-all duration-200 hover:from-gold hover:to-gold-deep disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            Add
          </button>
        </div>
      </section>

      <section className="rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
        <div className="px-6 py-5">
          <h2 className="text-sm font-semibold tracking-tight">Departments &amp; budgets</h2>
        </div>
        {state.departments.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-subtle">No departments yet.</p>
        ) : (
          <ul className="border-t border-border">
            {state.departments.map((d) => (
              <DepartmentRow key={d.id} dept={d} onSave={updateDepartment} onDelete={deleteDepartment} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function DepartmentRow({
  dept,
  onSave,
  onDelete,
}: {
  dept: Department;
  onSave: (id: string, patch: { name?: string; monthlyBudgetUsd?: number }) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState(dept.name);
  const [budget, setBudget] = useState(String(dept.monthlyBudgetUsd));
  const dirty = name !== dept.name || Number(budget) !== dept.monthlyBudgetUsd;

  return (
    <li className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-3.5 last:border-b-0">
      <input value={name} onChange={(e) => setName(e.target.value)} className={`${inputClass} h-9 flex-1 sm:max-w-xs`} />
      <div className="relative w-36">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">$</span>
        <input value={budget} onChange={(e) => setBudget(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className={`${inputClass} h-9 pl-7 font-mono`} />
      </div>
      <button
        onClick={() => onSave(dept.id, { name: name.trim(), monthlyBudgetUsd: Number(budget) || 0 })}
        disabled={!dirty}
        className="h-9 rounded-lg border border-border-strong bg-surface-2 px-3 text-xs font-medium text-muted transition-colors hover:border-gold/40 hover:text-gold disabled:opacity-40 disabled:hover:border-border-strong disabled:hover:text-muted cursor-pointer"
      >
        Save
      </button>
      <button
        onClick={() => onDelete(dept.id)}
        className="h-9 rounded-lg border border-border-strong bg-surface-2 px-3 text-xs font-medium text-muted transition-colors hover:border-danger/40 hover:text-danger cursor-pointer"
      >
        Remove
      </button>
    </li>
  );
}

function LogSpend() {
  const { state, recordSpend } = useInstitution();
  const [departmentId, setDepartmentId] = useState(state.departments[0]?.id ?? "");
  const [tool, setTool] = useState("");
  const [amount, setAmount] = useState("");
  const [spentOn, setSpentOn] = useState(new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    const amt = parseFloat(amount);
    if (!departmentId || !tool.trim() || isNaN(amt) || amt <= 0) return;
    setSaving(true);
    const ok = await recordSpend({ departmentId, tool: tool.trim(), amountUsd: amt, spentOn, note: note.trim() });
    setSaving(false);
    if (ok) {
      setTool("");
      setAmount("");
      setNote("");
    }
  }

  const recent = state.spend.slice(0, 12);
  const deptName = (id: string) => state.departments.find((d) => d.id === id)?.name ?? "—";

  if (state.departments.length === 0) {
    return <Empty title="Add a department first" body="Spend is logged against a department. Create one on the Departments tab." />;
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
        <h2 className="text-sm font-semibold tracking-tight">Log AI spend</h2>
        <p className="mt-0.5 text-xs text-subtle">Record a charge from any tool — ChatGPT, Claude, Copilot, etc.</p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">Department</label>
            <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className={`${inputClass} cursor-pointer`}>
              {state.departments.map((d) => (
                <option key={d.id} value={d.id}>{d.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">Tool / vendor</label>
            <input value={tool} onChange={(e) => setTool(e.target.value)} placeholder="OpenAI API" className={inputClass} />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">Amount (USD)</label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">$</span>
              <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} placeholder="0.00" inputMode="decimal" className={`${inputClass} pl-7 font-mono`} />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">Date</label>
            <input type="date" value={spentOn} onChange={(e) => setSpentOn(e.target.value)} className={`${inputClass} cursor-pointer`} />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">Note (optional)</label>
            <input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Monthly invoice" className={inputClass} />
          </div>
        </div>
        <button
          onClick={save}
          disabled={saving || !tool.trim() || !amount}
          className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-gradient-to-b from-gold-bright to-gold px-4 text-sm font-semibold text-[#0a0a0b] shadow-[0_1px_8px_rgba(232,184,95,0.25)] transition-all duration-200 hover:from-gold hover:to-gold-deep disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
        >
          {saving ? "Logging…" : "Log spend"}
        </button>
      </section>

      <SpendTable rows={recent} deptName={deptName} />
    </div>
  );
}

function SpendTable({ rows, deptName }: { rows: SpendEntry[]; deptName: (id: string) => string }) {
  return (
    <section className="rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
      <div className="px-6 py-5">
        <h2 className="text-sm font-semibold tracking-tight">Recent spend</h2>
      </div>
      {rows.length === 0 ? (
        <p className="px-6 pb-6 text-sm text-subtle">Nothing logged yet.</p>
      ) : (
        <ul className="border-t border-border">
          {rows.map((e) => (
            <li key={e.id} className="flex items-center gap-3 border-b border-border px-6 py-3 last:border-b-0">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {e.tool} <span className="text-subtle">· {deptName(e.departmentId)}</span>
                </p>
                <p className="text-xs text-subtle">
                  {e.spentOn}
                  {e.source === "csv" && <span className="ml-2 rounded bg-surface-2 px-1.5 py-0.5 text-[10px] text-muted">CSV</span>}
                  {e.note ? ` · ${e.note}` : ""}
                </p>
              </div>
              <span className="tnum shrink-0 font-mono text-sm font-medium">{usd(e.amountUsd, { cents: true })}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

// ─── CSV import ──────────────────────────────────────────────────────────────
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') {
        if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += c;
    } else if (c === '"') {
      inQ = true;
    } else if (c === ",") {
      row.push(cur); cur = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      if (row.some((x) => x.trim() !== "")) rows.push(row);
      row = [];
    } else cur += c;
  }
  if (cur !== "" || row.length) {
    row.push(cur);
    if (row.some((x) => x.trim() !== "")) rows.push(row);
  }
  return rows;
}

interface ParsedRow {
  departmentName: string;
  departmentId: string | null;
  tool: string;
  amountUsd: number;
  spentOn: string;
  note: string;
  ok: boolean;
}

function ImportCsv() {
  const { state, importSpend } = useInstitution();
  const [raw, setRaw] = useState("");
  const [importing, setImporting] = useState(false);

  const parsed: ParsedRow[] = useMemo(() => {
    if (!raw.trim()) return [];
    const grid = parseCsv(raw);
    if (grid.length === 0) return [];
    // Detect a header row and map columns by name; otherwise assume positional.
    const header = grid[0].map((h) => h.trim().toLowerCase());
    const hasHeader = header.some((h) => ["department", "tool", "amount", "date", "note", "vendor"].includes(h));
    const idx = (names: string[], fallback: number) => {
      if (!hasHeader) return fallback;
      for (const n of names) { const i = header.indexOf(n); if (i !== -1) return i; }
      return fallback;
    };
    const di = idx(["department", "team"], 0);
    const ti = idx(["tool", "vendor", "service"], 1);
    const ai = idx(["amount", "cost", "usd", "spend"], 2);
    const dti = idx(["date", "spent_on", "month"], 3);
    const ni = idx(["note", "memo", "description"], 4);

    const byName = new Map(state.departments.map((d) => [d.name.trim().toLowerCase(), d]));
    const body = hasHeader ? grid.slice(1) : grid;
    return body.map((cells) => {
      const departmentName = (cells[di] ?? "").trim();
      const dept = byName.get(departmentName.toLowerCase()) ?? null;
      const amountUsd = parseFloat((cells[ai] ?? "").replace(/[^0-9.\-]/g, ""));
      const rawDate = (cells[dti] ?? "").trim();
      const spentOn = /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : new Date().toISOString().slice(0, 10);
      const tool = (cells[ti] ?? "").trim();
      const note = (cells[ni] ?? "").trim();
      const ok = !!dept && !!tool && !isNaN(amountUsd) && amountUsd > 0;
      return { departmentName, departmentId: dept?.id ?? null, tool, amountUsd: isNaN(amountUsd) ? 0 : amountUsd, spentOn, note, ok };
    });
  }, [raw, state.departments]);

  const validRows = parsed.filter((r) => r.ok);

  async function commit() {
    const payload: SpendInput[] = validRows.map((r) => ({
      departmentId: r.departmentId!,
      tool: r.tool,
      amountUsd: r.amountUsd,
      spentOn: r.spentOn,
      note: r.note,
    }));
    if (payload.length === 0) return;
    setImporting(true);
    await importSpend(payload);
    setImporting(false);
    setRaw("");
  }

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then(setRaw);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
        <h2 className="text-sm font-semibold tracking-tight">Import spend from CSV</h2>
        <p className="mt-0.5 text-xs text-subtle">
          Columns: <span className="font-mono text-muted">department, tool, amount, date, note</span>. A header row is
          optional; department names must match existing departments.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex h-9 cursor-pointer items-center rounded-lg border border-border-strong bg-surface-2 px-3 text-xs font-medium text-muted transition-colors hover:border-gold/40 hover:text-gold">
            Choose CSV file
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
          </label>
          <button
            onClick={() => setRaw("department,tool,amount,date,note\nEngineering,OpenAI API,1240.50,2026-06-12,June usage\nMarketing,ChatGPT Team,300,2026-06-09,Seats\nOperations,Otter.ai,80,2026-06-15,")}
            className="text-xs font-medium text-gold hover:text-gold-bright cursor-pointer"
          >
            Load sample
          </button>
        </div>

        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder="Paste CSV here, or choose a file above…"
          rows={6}
          className="mt-3 w-full rounded-lg border border-border-strong bg-surface px-3 py-2 font-mono text-xs outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/15"
        />
      </section>

      {parsed.length > 0 && (
        <section className="rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between gap-3 px-6 py-5">
            <h2 className="text-sm font-semibold tracking-tight">
              Preview · <span className="text-positive">{validRows.length} ready</span>
              {parsed.length - validRows.length > 0 && (
                <span className="text-danger"> · {parsed.length - validRows.length} skipped</span>
              )}
            </h2>
            <button
              onClick={commit}
              disabled={importing || validRows.length === 0}
              className="inline-flex h-9 items-center rounded-lg bg-gradient-to-b from-gold-bright to-gold px-4 text-xs font-semibold text-[#0a0a0b] shadow-[0_1px_8px_rgba(232,184,95,0.25)] transition-all duration-200 hover:from-gold hover:to-gold-deep disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
            >
              {importing ? "Importing…" : `Import ${validRows.length} rows`}
            </button>
          </div>
          <ul className="border-t border-border">
            {parsed.map((r, i) => (
              <li key={i} className="flex items-center gap-3 border-b border-border px-6 py-2.5 last:border-b-0">
                <span className={`h-2 w-2 shrink-0 rounded-full ${r.ok ? "bg-positive" : "bg-danger"}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">
                    {r.tool || <span className="text-subtle">(no tool)</span>}{" "}
                    <span className="text-subtle">· {r.departmentName || "(no department)"}</span>
                  </p>
                  {!r.ok && (
                    <p className="text-[11px] text-danger">
                      {!r.departmentId ? "Department not found" : !r.tool ? "Missing tool" : "Invalid amount"}
                    </p>
                  )}
                </div>
                <span className="tnum shrink-0 font-mono text-xs text-muted">{usd(r.amountUsd, { cents: true })}</span>
                <span className="shrink-0 text-[11px] text-subtle">{r.spentOn}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** Metered BYO-key chat, billed in USD against a department budget. */
function ChatTab() {
  const { state } = useInstitution();
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [extraModels, setExtraModels] = useState<{ id: string; label: string }[]>([]);

  useEffect(() => {
    fetch("/api/provider-keys")
      .then((r) => r.json())
      .then((d) => {
        const keys: Array<{ provider: string; custom_model?: string | null; custom_model_label?: string | null }> = d.keys ?? [];
        setAvailableProviders(Array.from(new Set(keys.map((k) => k.provider))));
        setExtraModels(
          keys
            .filter((k) => k.provider === "custom" && k.custom_model)
            .map((k) => ({ id: k.custom_model as string, label: (k.custom_model_label as string) ?? (k.custom_model as string) })),
        );
      })
      .catch(() => { setAvailableProviders([]); setExtraModels([]); });
  }, []);

  const accounts = state.departments.map((d) => ({ id: d.id, name: d.name }));
  if (accounts.length === 0) {
    return <Empty title="No departments yet" body="Add a department on the Departments tab first — metered chat bills its USD cost to a department budget." />;
  }
  if (availableProviders.length === 0) {
    return <Empty title="No API keys yet" body="Add your own provider key on the AI Keys tab. Chat runs on your keys and logs the USD cost against a department." />;
  }

  return (
    <div className="flex flex-col gap-3" style={{ height: "calc(100vh - 230px)" }}>
      <p className="text-sm text-subtle">
        Chat runs on <span className="font-medium text-foreground">your own API keys</span>. Each reply&apos;s exact USD
        cost is logged as metered spend against the department you pick — feeding its budget and alerts.
      </p>
      <ChatWorkspace
        accounts={accounts}
        availableProviders={availableProviders}
        extraModels={extraModels}
        storageKey={`institution-${state.workspaceId}`}
        billingMode="usd"
        accountNoun="department"
      />
    </div>
  );
}

/** BYO-key management for the institution — add keys, delegate to departments. */
function KeysTab() {
  const { state } = useInstitution();
  return <InstitutionKeys departments={state.departments.map((d) => ({ id: d.id, name: d.name }))} />;
}

function Account() {
  const { state, setWorkspaceType, signOut, changeTier } = useInstitution();
  const [confirming, setConfirming] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const renews = state.subscriptionCurrentPeriodEnd
    ? new Date(state.subscriptionCurrentPeriodEnd).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  const tier = tierById(state.institutionalTier);
  const limit = state.institutionalSeatLimit;
  const used = state.activeUserCount;
  const pctUsed = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;

  return (
    <div className="space-y-6">
      {/* Plan & seats */}
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
        <h2 className="text-sm font-semibold tracking-tight">Plan &amp; seats</h2>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-positive-soft px-2.5 py-1 text-[11px] font-semibold text-positive">
              <span className="h-1.5 w-1.5 rounded-full bg-positive" />
              Active · {tier ? `${tier.label} plan` : "Tokeville Institutional (legacy)"}
            </span>
            <p className="mt-1.5 text-xs text-subtle">
              {tier?.priceUsd != null ? `$${tier.priceUsd}/month` : tier?.id === "enterprise" ? "Custom pricing" : "$99/month (legacy flat plan)"}
              {renews ? ` · renews ${renews}` : ""}
            </p>
          </div>
          <div className="text-right">
            <p className="tnum font-mono text-sm font-bold">
              {used}{limit != null ? ` / ${limit}` : ""} <span className="text-xs font-normal text-subtle">active users</span>
            </p>
            <p className="text-[11px] text-subtle">spent tokens this billing month</p>
          </div>
        </div>
        {limit != null && (
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2">
            <div
              className={`h-full rounded-full ${pctUsed >= 100 ? "bg-danger" : pctUsed >= 80 ? "bg-gold" : "bg-positive"}`}
              style={{ width: `${pctUsed}%` }}
            />
          </div>
        )}

        {/* Upgrade / change plan */}
        <div className="mt-5">
          <p className="text-xs font-medium uppercase tracking-wide text-subtle">Change plan</p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {INSTITUTIONAL_TIERS.map((t) =>
              t.priceUsd != null ? (
                <button
                  key={t.id}
                  disabled={switching !== null || t.id === tier?.id}
                  onClick={async () => { setSwitching(t.id); await changeTier(t.id); setSwitching(null); }}
                  className={`flex items-center justify-between rounded-xl border px-3.5 py-2.5 text-left transition-colors ${
                    t.id === tier?.id
                      ? "border-gold/60 bg-gold-soft opacity-80"
                      : "border-border bg-surface-2 hover:border-gold/40 cursor-pointer"
                  } disabled:cursor-default`}
                >
                  <span>
                    <span className="text-sm font-semibold">{t.label}{t.id === tier?.id ? " · current" : ""}</span>
                    <span className="block text-[11px] text-subtle">{t.blurb}</span>
                  </span>
                  <span className="tnum font-mono text-sm font-bold text-gold">
                    {switching === t.id ? "…" : <>${t.priceUsd}<span className="text-[11px] font-normal text-subtle">/mo</span></>}
                  </span>
                </button>
              ) : (
                <a
                  key={t.id}
                  href="mailto:sales@tokeville.app?subject=Tokeville%20Institutional%20Enterprise"
                  className="flex items-center justify-between rounded-xl border border-dashed border-border px-3.5 py-2.5 transition-colors hover:border-gold/40 cursor-pointer"
                >
                  <span>
                    <span className="text-sm font-semibold">{t.label}</span>
                    <span className="block text-[11px] text-subtle">{t.blurb}</span>
                  </span>
                  <span className="text-xs font-medium text-gold">Contact us →</span>
                </a>
              ),
            )}
          </div>
          <p className="mt-2 text-[11px] text-subtle">
            Billing scales with active users — members who metered spend this month — not departments. Changes prorate via Stripe.
          </p>
        </div>
      </section>

      {/* Account type */}
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
        <h2 className="text-sm font-semibold tracking-tight">Account type</h2>
        <p className="mt-1 text-sm text-muted">
          This is an <span className="font-medium text-gold">Institutional</span> workspace — you budget your own or
          contracted AI, billed by subscription. Switch to a <span className="font-medium">Managed</span> workspace to
          instead pay all your AI through Tokeville — deposit funds that run on Tokeville&apos;s own keys, budgeted and
          metered per call.
        </p>
        {confirming ? (
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={() => setWorkspaceType("team")}
              className="inline-flex h-9 items-center rounded-lg bg-gradient-to-b from-gold-bright to-gold px-4 text-xs font-semibold text-[#0a0a0b] cursor-pointer"
            >
              Confirm switch to Managed
            </button>
            <button onClick={() => setConfirming(false)} className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-xs text-muted hover:bg-surface-2 cursor-pointer">
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="mt-4 inline-flex h-9 items-center rounded-lg border border-border-strong bg-surface-2 px-4 text-xs font-medium text-muted transition-colors hover:border-gold/40 hover:text-gold cursor-pointer"
          >
            Switch to Managed workspace
          </button>
        )}
      </section>

      <section className="rounded-2xl border border-danger/25 bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Sign out</p>
            <p className="text-xs text-subtle">End your session on this device</p>
          </div>
          <button onClick={() => signOut()} className="h-9 rounded-lg border border-border-strong bg-surface-2 px-4 text-sm font-medium text-foreground transition-colors hover:border-gold/40 hover:text-gold cursor-pointer">
            Sign out
          </button>
        </div>
      </section>
    </div>
  );
}

// ─── shared bits ─────────────────────────────────────────────────────────────
function Kpi({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
      <p className="text-xs uppercase tracking-wide text-subtle">{label}</p>
      <p className={`tnum mt-1.5 font-mono text-2xl font-bold ${accent ? "text-gold" : ""}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-subtle">{sub}</p>}
    </div>
  );
}

function Empty({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border py-12 text-center">
      <p className="text-sm font-medium text-muted">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-xs text-subtle">{body}</p>
    </div>
  );
}

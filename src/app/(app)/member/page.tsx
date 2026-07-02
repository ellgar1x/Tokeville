"use client";

import { useEffect, useState } from "react";
import { useMember } from "@/store/member";
import { ChatWorkspace } from "@/components/ChatWorkspace";
import { MemberTabBar, type MemberTab } from "@/components/MemberShell";
import { type ProviderId } from "@/lib/data";
import { pct, tok, tokAmount, usd, usdFromTokens } from "@/lib/format";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  CheckIcon,
  PlusIcon,
  SendIcon,
  ShieldIcon,
} from "@/components/icons";

const PROVIDER_META: Record<ProviderId, { name: string; model: string; color: string }> = {
  anthropic: { name: "Anthropic", model: "Claude Opus 4.8", color: "var(--anthropic)" },
  openai: { name: "OpenAI", model: "GPT-4o", color: "var(--openai)" },
  google: { name: "Google", model: "Gemini 2.0 Flash", color: "var(--google)" },
  other: { name: "Other", model: "Custom", color: "var(--other)" },
};

const ALL_PROVIDERS: ProviderId[] = ["anthropic", "openai", "google"];
const AMOUNTS = [
  { label: "1M", value: 1_000_000 },
  { label: "5M", value: 5_000_000 },
  { label: "10M", value: 10_000_000 },
];

const PRESET_PALETTES = [
  { label: "Gold (default)", primary: "#e8b85f", secondary: "#c79a45" },
  { label: "Midnight Blue", primary: "#3b82f6", secondary: "#1d4ed8" },
  { label: "Emerald", primary: "#10b981", secondary: "#059669" },
  { label: "Violet", primary: "#8b5cf6", secondary: "#6d28d9" },
  { label: "Rose", primary: "#f43f5e", secondary: "#be123c" },
  { label: "Amber", primary: "#f59e0b", secondary: "#b45309" },
  { label: "Cyan", primary: "#06b6d4", secondary: "#0e7490" },
  { label: "Slate", primary: "#64748b", secondary: "#334155" },
];

export default function MemberPage() {
  const { state, userId, useAI, connectAccount, requestBudget, updateColors } = useMember();
  const { projects, connectedAccounts } = state;

  const [tab, setTab] = useState<MemberTab>("overview");
  const [primaryColor, setPrimaryColor] = useState(state.primaryColor);
  const [secondaryColor, setSecondaryColor] = useState(state.secondaryColor);
  // Sync picker state when store loads persisted colors from localStorage
  useEffect(() => { setPrimaryColor(state.primaryColor); }, [state.primaryColor]);
  useEffect(() => { setSecondaryColor(state.secondaryColor); }, [state.secondaryColor]);
  const [activeProject, setActiveProject] = useState(projects[0]?.id ?? "");
  const [availableProviders, setAvailableProviders] = useState<string[]>(["anthropic"]);
  useEffect(() => {
    fetch("/api/provider-keys")
      .then((r) => r.json())
      .then((d) => {
        const providers: string[] = (d.keys ?? []).map((k: { provider: string }) => k.provider);
        if (!providers.includes("anthropic")) providers.push("anthropic");
        setAvailableProviders(providers);
      })
      .catch(() => {});
  }, []);

  const [provider, setProvider] = useState("");
  const [amount, setAmount] = useState(1_000_000);
  const [running, setRunning] = useState(false);
  const [reqProject, setReqProject] = useState(projects[0]?.id ?? "");
  const [reqAmount, setReqAmount] = useState("50");
  const [reqMessage, setReqMessage] = useState("");
  const [sending, setSending] = useState(false);

  if (projects.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center">
        <h1 className="text-lg font-semibold">No projects assigned yet</h1>
        <p className="mt-1 text-sm text-muted">
          Your workspace admin hasn&apos;t added you to a project. Check back soon.
        </p>
      </div>
    );
  }

  const active = projects.find((p) => p.id === activeProject) ?? projects[0];
  const activeRemaining = active.tokenBudget - active.tokensUsed;
  const connectedProviders = connectedAccounts.map((a) => a.providerKey);
  const unconnected = ALL_PROVIDERS.filter((p) => !connectedProviders.includes(p));

  const modelOptions = [
    ...connectedAccounts.map((a) => ({
      key: a.providerKey as string,
      label: PROVIDER_META[a.providerKey].model,
      internal: false,
    })),
    ...state.internalProviders.map((p) => ({
      key: p.key,
      label: p.name,
      internal: true,
    })),
  ];
  const selectedKey = provider || modelOptions[0]?.key || "";
  const selected = modelOptions.find((m) => m.key === selectedKey);

  async function run() {
    if (!selected) return;
    setRunning(true);
    await useAI({ subAccountId: active.id, provider: selected.key, label: selected.label, amount });
    setRunning(false);
  }

  async function sendRequest() {
    const tokens = Math.max((parseFloat(reqAmount) || 0) * 1_000_000, 0);
    if (!reqProject || tokens <= 0) return;
    setSending(true);
    await requestBudget({ subAccountId: reqProject, amount: tokens, message: reqMessage });
    setSending(false);
    setReqMessage("");
  }

  const inputClass =
    "w-full rounded-lg border border-border-strong bg-surface px-3 text-sm outline-none transition-colors duration-200 placeholder:text-subtle focus:border-gold/50 focus:ring-2 focus:ring-gold/15";

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Welcome, {state.profile.displayName || "there"}
          </h1>
          <p className="mt-1 text-sm text-muted">
            {state.workspaceName} · {projects.length}{" "}
            {projects.length === 1 ? "project" : "projects"}
          </p>
        </div>
        <MemberTabBar active={tab} onChange={setTab} />
      </div>

      {/* ── Overview tab ─────────────────────────────────── */}
      {tab === "overview" && (
        <div className="space-y-6">
          {/* Project cards */}
          <section>
            <h2 className="mb-3 text-sm font-semibold tracking-tight text-muted uppercase tracking-wider">
              Your projects
            </h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {projects.map((p) => {
                const remaining = p.tokenBudget - p.tokensUsed;
                const used = (p.tokensUsed / p.tokenBudget) * 100;
                const near = used >= 85;
                const isActive = p.id === active.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setActiveProject(p.id)}
                    className={`rounded-2xl border bg-surface p-5 text-left transition-all duration-200 cursor-pointer ${
                      isActive
                        ? "border-gold/50 ring-1 ring-gold/20 shadow-[0_0_20px_rgba(232,184,95,0.08)]"
                        : "border-border hover:border-border-strong hover:shadow-sm"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold">{p.name}</span>
                      <span className="rounded-full border border-border bg-surface-2 px-1.5 py-0.5 text-[10px] font-medium text-muted">
                        {p.type}
                      </span>
                    </div>
                    <p className="tnum gold-text mt-3 font-mono text-2xl font-bold tracking-tight">
                      Ŧ{tokAmount(remaining)}
                    </p>
                    <p className="text-xs text-subtle">≈ {usd(usdFromTokens(remaining))} left</p>
                    <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{
                          width: `${Math.min(used, 100)}%`,
                          backgroundColor: near ? "var(--warning)" : "var(--gold)",
                        }}
                      />
                    </div>
                    <p className="tnum mt-1.5 text-[11px] text-subtle">
                      {tok(p.tokensUsed)} of {tok(p.tokenBudget)} used · {pct(used)}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Two-col: Connected accounts + Budget requests */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Connected AI accounts */}
            <section className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
              <h2 className="text-sm font-semibold tracking-tight">Connected AI accounts</h2>
              <p className="mt-0.5 text-xs text-subtle">Tokeville meters usage automatically</p>
              <ul className="mt-4 space-y-2">
                {connectedAccounts.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: PROVIDER_META[a.providerKey].color }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{PROVIDER_META[a.providerKey].name}</p>
                      <p className="truncate text-xs text-subtle">{a.accountEmail}</p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-positive">
                      <CheckIcon className="h-3.5 w-3.5" /> Connected
                    </span>
                  </li>
                ))}
              </ul>
              {unconnected.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {unconnected.map((p) => (
                    <button
                      key={p}
                      onClick={() => connectAccount(p)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-border-strong bg-surface px-3 py-1.5 text-xs font-medium text-muted transition-colors duration-200 hover:border-gold/40 hover:text-gold cursor-pointer"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      Connect {PROVIDER_META[p].name}
                    </button>
                  ))}
                </div>
              )}
              {state.internalProviders.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-subtle">Company AI</p>
                  <ul className="space-y-2">
                    {state.internalProviders.map((p) => (
                      <li key={p.key} className="flex items-center gap-3 rounded-lg border border-gold/20 bg-gold-soft px-3 py-2.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{p.name}</p>
                          <p className="truncate text-xs text-subtle">{p.models}</p>
                        </div>
                        <span className="inline-flex items-center gap-1 rounded-full border border-gold/30 px-1.5 py-0.5 text-[10px] font-medium text-gold">
                          <ShieldIcon className="h-2.5 w-2.5" /> Internal
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Metered usage simulator */}
              <div className="mt-5 border-t border-border pt-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-subtle">Simulate metered usage</p>
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="mb-1 block text-[11px] text-subtle">Project</label>
                    <select value={active.id} onChange={(e) => setActiveProject(e.target.value)} className={`${inputClass} h-9 cursor-pointer`}>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-subtle">Model</label>
                    <select value={selectedKey} onChange={(e) => setProvider(e.target.value)} className={`${inputClass} h-9 cursor-pointer`} disabled={modelOptions.length === 0}>
                      {modelOptions.map((m) => (
                        <option key={m.key} value={m.key}>{m.label}{m.internal ? " · Internal" : ""}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    {AMOUNTS.map((a) => (
                      <button key={a.label} onClick={() => setAmount(a.value)}
                        className={`flex-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors duration-200 cursor-pointer ${amount === a.value ? "border-gold/50 bg-gold-soft text-foreground" : "border-border bg-surface-2 text-muted hover:text-foreground"}`}>
                        Ŧ{a.label}
                      </button>
                    ))}
                  </div>
                  <button onClick={run} disabled={running || modelOptions.length === 0 || amount > activeRemaining}
                    className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-gold-bright to-gold text-sm font-semibold text-[#0a0a0b] shadow-[0_1px_8px_rgba(232,184,95,0.25)] transition-all duration-200 hover:from-gold hover:to-gold-deep disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none cursor-pointer">
                    <SendIcon className="h-4 w-4" />
                    {modelOptions.length === 0 ? "No models available" : amount > activeRemaining ? "Not enough budget" : `Meter Ŧ${tokAmount(amount)} on ${active.name}`}
                  </button>
                </div>
              </div>
            </section>

            {/* Budget requests */}
            <section className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
              <h2 className="text-sm font-semibold tracking-tight">Request a budget raise</h2>
              <p className="mt-0.5 text-xs text-subtle">Message your admin to top up a project</p>
              <div className="mt-4 space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="mb-1 block text-[11px] text-subtle">Project</label>
                    <select value={reqProject} onChange={(e) => setReqProject(e.target.value)} className={`${inputClass} h-9 cursor-pointer`}>
                      {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div className="w-28">
                    <label className="mb-1 block text-[11px] text-subtle">Amount (M)</label>
                    <div className="relative">
                      <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-sm text-gold">Ŧ</span>
                      <input value={reqAmount} onChange={(e) => setReqAmount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className={`${inputClass} h-9 pl-6 tnum font-mono`} />
                    </div>
                  </div>
                </div>
                <textarea value={reqMessage} onChange={(e) => setReqMessage(e.target.value)} rows={3} placeholder="Why do you need more budget?" className={`${inputClass} resize-none py-2`} />
                <button onClick={sendRequest} disabled={sending || !reqProject}
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-surface-2 text-sm font-medium text-foreground transition-colors duration-200 hover:border-gold/40 hover:text-gold disabled:opacity-50 cursor-pointer">
                  <SendIcon className="h-4 w-4" />
                  {sending ? "Sending…" : "Send request"}
                </button>
              </div>
              {state.requests.length > 0 && (
                <ul className="mt-5 space-y-2 border-t border-border pt-4">
                  {state.requests.map((r) => (
                    <li key={r.id} className="rounded-lg border border-border bg-surface-2 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{tok(r.amountTokens)} · {r.subAccountName}</span>
                        <StatusBadge status={r.status} />
                      </div>
                      {r.message && <p className="mt-1 text-xs text-muted">"{r.message}"</p>}
                      {r.adminResponse && <p className="mt-1 text-xs text-gold">Admin: {r.adminResponse}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
          {/* Appearance */}
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
            <h2 className="text-sm font-semibold tracking-tight">Appearance</h2>
            <p className="mt-0.5 text-xs text-subtle">Customize your accent color. Saved to this device only.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              {PRESET_PALETTES.map((p) => (
                <button
                  key={p.label}
                  title={p.label}
                  onClick={() => { setPrimaryColor(p.primary); setSecondaryColor(p.secondary); updateColors({ primaryColor: p.primary, secondaryColor: p.secondary }); }}
                  className={`h-8 w-8 rounded-full border-2 transition-all duration-150 cursor-pointer ${primaryColor === p.primary ? "border-foreground scale-110" : "border-transparent hover:scale-105"}`}
                  style={{ background: `linear-gradient(135deg, ${p.primary}, ${p.secondary})` }}
                >
                  <span className="sr-only">{p.label}</span>
                </button>
              ))}
            </div>
            <div className="mt-4 grid grid-cols-2 gap-4">
              <div>
                <label className="mb-1.5 block text-xs font-medium text-subtle">Primary</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                    className="h-9 w-9 cursor-pointer rounded-lg border border-border-strong bg-surface p-0.5" />
                  <input value={primaryColor}
                    onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setPrimaryColor(e.target.value); }}
                    className="h-9 flex-1 rounded-lg border border-border-strong bg-surface px-3 font-mono text-sm outline-none focus:border-gold/50" maxLength={7} />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-medium text-subtle">Secondary</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)}
                    className="h-9 w-9 cursor-pointer rounded-lg border border-border-strong bg-surface p-0.5" />
                  <input value={secondaryColor}
                    onChange={(e) => { if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) setSecondaryColor(e.target.value); }}
                    className="h-9 flex-1 rounded-lg border border-border-strong bg-surface px-3 font-mono text-sm outline-none focus:border-gold/50" maxLength={7} />
                </div>
              </div>
            </div>
            <button
              onClick={() => updateColors({ primaryColor, secondaryColor })}
              className="mt-4 inline-flex h-9 items-center justify-center rounded-lg bg-gradient-to-b from-gold-bright to-gold px-5 text-sm font-semibold text-[#0a0a0b] shadow-[0_1px_8px_rgba(232,184,95,0.25)] transition-all duration-200 hover:from-gold hover:to-gold-deep cursor-pointer"
            >
              Apply
            </button>
          </section>
        </div>
      )}

      {/* ── Chat tab ─────────────────────────────────────── */}
      {tab === "chat" && (
        <div className="flex flex-col gap-3" style={{ height: "calc(100vh - 200px)" }}>
          <div>
            <h2 className="text-lg font-semibold tracking-tight">AI Workspace</h2>
            <p className="mt-0.5 text-sm text-muted">
              Access every AI model through Tokeville. Usage is metered against your project budget.
            </p>
          </div>
          <ChatWorkspace
            accounts={projects.map((p) => ({ id: p.id, name: p.name }))}
            availableProviders={availableProviders}
            storageKey={`member-${userId}`}
          />
        </div>
      )}

      {/* ── Activity tab ─────────────────────────────────── */}
      {tab === "activity" && (
        <div className="space-y-4">
          <div>
            <h2 className="text-lg font-semibold tracking-tight">Activity</h2>
            <p className="mt-0.5 text-sm text-muted">Your token ledger across all projects.</p>
          </div>
          <section className="rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
            <ul>
              {state.activity.length === 0 && (
                <li className="px-6 py-12 text-center text-sm text-subtle">
                  No usage yet. Meter a request or send a chat message to see it here.
                </li>
              )}
              {state.activity.map((e) => {
                const inflow = e.tokens > 0;
                return (
                  <li key={e.id} className="flex items-center gap-4 border-b border-border px-6 py-4 last:border-b-0 hover:bg-surface-2 transition-colors">
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border ${inflow ? "border-positive/30 bg-positive-soft text-positive" : "border-border-strong bg-surface-2 text-muted"}`}>
                      {inflow ? <ArrowDownLeftIcon className="h-4 w-4" /> : <ArrowUpRightIcon className="h-4 w-4" />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{e.title}</p>
                      <p className="truncate text-xs text-subtle">{e.detail || e.time}</p>
                    </div>
                    <div className="text-right">
                      <p className={`tnum font-mono text-sm font-semibold ${inflow ? "text-gold" : "text-foreground"}`}>
                        {inflow ? "+" : "−"}{tok(Math.abs(e.tokens))}
                      </p>
                      <p className="tnum text-[11px] text-subtle">{e.time}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: "pending" | "approved" | "declined" }) {
  const map = {
    pending: "border-warning/30 bg-warning-soft text-warning",
    approved: "border-positive/30 bg-positive-soft text-positive",
    declined: "border-danger/30 bg-danger-soft text-danger",
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-medium capitalize ${map[status]}`}>
      {status}
    </span>
  );
}

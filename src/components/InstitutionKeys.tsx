"use client";

import { useEffect, useState } from "react";
import { usd, usdFromTokens } from "@/lib/format";

/**
 * BYO-key management for Institutional (bring-your-own-key) workspaces. The
 * customer pastes their OWN provider keys; Institutional chat routes through
 * them and logs metered USD spend against departments. Keys can be delegated to
 * a department so a single key never serves the whole institution.
 */

interface StoredKey {
  id: string;
  provider: string;
  label: string;
  base_url?: string | null;
  budget_tokens?: number | null;
  spent_tokens?: number | null;
  owner_user_id?: string | null;
  assigned_department_id?: string | null;
  created_at: string;
}

const PROVIDER_OPTIONS: { key: string; label: string; color: string; placeholder: string; needsUrl?: boolean }[] = [
  { key: "anthropic", label: "Anthropic", color: "#cc785c", placeholder: "sk-ant-…" },
  { key: "openai", label: "OpenAI", color: "#10a37f", placeholder: "sk-…" },
  { key: "google", label: "Google AI", color: "#4285f4", placeholder: "AIza…" },
  { key: "custom", label: "Custom / OpenAI-compatible", color: "#888", placeholder: "sk-… or any key", needsUrl: true },
];

const API_KEY_SOURCES = [
  { key: "anthropic", label: "Anthropic", color: "#cc785c", url: "https://console.anthropic.com/settings/keys" },
  { key: "openai", label: "OpenAI", color: "#10a37f", url: "https://platform.openai.com/api-keys" },
  { key: "google", label: "Google AI Studio", color: "#4285f4", url: "https://aistudio.google.com/app/apikey" },
];

export function InstitutionKeys({ departments }: { departments: { id: string; name: string }[] }) {
  const [keys, setKeys] = useState<StoredKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ provider: "anthropic", label: "Anthropic", apiKey: "", baseUrl: "", budgetUsd: "" });

  const opt = PROVIDER_OPTIONS.find((p) => p.key === form.provider)!;
  const inputClass =
    "h-10 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm outline-none transition-colors duration-200 placeholder:text-subtle focus:border-gold/50 focus:ring-2 focus:ring-gold/15";
  const providerColor = (k: string) => PROVIDER_OPTIONS.find((p) => p.key === k)?.color ?? "#888";
  const providerLabel = (k: string) => PROVIDER_OPTIONS.find((p) => p.key === k)?.label ?? k;

  useEffect(() => {
    fetch("/api/provider-keys")
      .then((r) => r.json())
      .then((d) => setKeys(d.keys ?? []))
      .finally(() => setLoading(false));
  }, []);

  async function addKey() {
    setError(null);
    if (!form.apiKey.trim()) { setError("API key is required."); return; }
    if (opt.needsUrl && !form.baseUrl.trim()) { setError("Base URL is required for custom providers."); return; }
    setAdding(true);
    const res = await fetch("/api/provider-keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        provider: form.provider,
        label: form.label,
        apiKey: form.apiKey,
        baseUrl: form.baseUrl || undefined,
        budgetUsd: form.budgetUsd ? parseFloat(form.budgetUsd) : undefined,
      }),
    });
    const data = await res.json();
    setAdding(false);
    if (!res.ok) { setError(data.error); return; }
    setKeys((prev) => [...prev, data.key]);
    setForm({ provider: "anthropic", label: "Anthropic", apiKey: "", baseUrl: "", budgetUsd: "" });
    setShowForm(false);
  }

  async function deleteKey(id: string) {
    setDeleting(id);
    await fetch(`/api/provider-keys?id=${id}`, { method: "DELETE" });
    setKeys((prev) => prev.filter((k) => k.id !== id));
    setDeleting(null);
  }

  async function assign(id: string, assignTo: string) {
    setAssigningId(id);
    const res = await fetch("/api/provider-keys", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, assignTo }),
    });
    const data = await res.json();
    setAssigningId(null);
    if (res.ok) setKeys((prev) => prev.map((k) => (k.id === id ? data.key : k)));
  }

  const assignValue = (k: StoredKey) => (k.assigned_department_id ? `department:${k.assigned_department_id}` : "shared");
  const assignLabel = (k: StoredKey) => {
    if (k.assigned_department_id) {
      const d = departments.find((x) => x.id === k.assigned_department_id);
      return { text: `Department · ${d?.name ?? "…"}`, gold: true };
    }
    return { text: "Shared workspace-wide", gold: false };
  };

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)] sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">Your AI keys</h2>
          <p className="mt-0.5 text-xs text-subtle">
            Bring your own provider keys. Chat runs on them and each call is metered as USD spend
            against a department — your key pays the provider, Tokeville does the budgeting.
          </p>
        </div>
        {!showForm && (
          <button
            onClick={() => { setShowForm(true); setError(null); }}
            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-gradient-to-b from-gold-bright to-gold px-4 text-xs font-semibold text-[#0a0a0b] shadow-[0_1px_8px_rgba(232,184,95,0.25)] transition-all duration-200 hover:from-gold hover:to-gold-deep cursor-pointer"
          >
            + Add key
          </button>
        )}
      </div>

      {showForm && (
        <div className="mt-5 space-y-3 rounded-xl border border-border-strong bg-surface-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">New API key</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-subtle">Provider</label>
              <select
                value={form.provider}
                onChange={(e) => setForm((f) => ({ ...f, provider: e.target.value, label: PROVIDER_OPTIONS.find((o) => o.key === e.target.value)?.label ?? e.target.value }))}
                className="h-10 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm outline-none focus:border-gold/50 cursor-pointer"
              >
                {PROVIDER_OPTIONS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-subtle">Label</label>
              <input value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} placeholder="e.g. Anthropic — Eng" className={inputClass} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-subtle">API key</label>
              <input type="password" value={form.apiKey} onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))} placeholder={opt.placeholder} autoComplete="off" className={inputClass} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-subtle">Monthly cap (optional)</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">$</span>
                <input value={form.budgetUsd} onChange={(e) => setForm((f) => ({ ...f, budgetUsd: e.target.value.replace(/[^0-9.]/g, "") }))} placeholder="No cap" inputMode="decimal" className={`${inputClass} pl-7 font-mono`} />
              </div>
            </div>
          </div>
          {opt.needsUrl && (
            <div>
              <label className="mb-1 block text-xs font-medium text-subtle">Base URL <span className="text-danger">*</span></label>
              <input value={form.baseUrl} onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))} placeholder="https://api.your-provider.com/v1" className={inputClass} />
            </div>
          )}
          {error && <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">{error}</p>}
          <div className="flex gap-2">
            <button onClick={addKey} disabled={adding} className="inline-flex h-9 items-center rounded-lg bg-gradient-to-b from-gold-bright to-gold px-4 text-xs font-semibold text-[#0a0a0b] transition-all hover:from-gold hover:to-gold-deep disabled:opacity-40 cursor-pointer">
              {adding ? "Saving…" : "Save key"}
            </button>
            <button onClick={() => { setShowForm(false); setError(null); }} className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-xs font-medium text-muted hover:bg-surface-2 cursor-pointer">Cancel</button>
          </div>
        </div>
      )}

      <div className="mt-4">
        {loading ? (
          <p className="text-xs text-subtle">Loading…</p>
        ) : keys.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-8 text-center">
            <p className="text-sm font-medium text-muted">No API keys yet</p>
            <p className="mt-1 text-xs text-subtle">Add your own provider key to start metered chat.</p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {keys.map((k) => {
              const budget = k.budget_tokens ?? null;
              const spent = Number(k.spent_tokens ?? 0);
              const ratio = budget && budget > 0 ? Math.min(spent / budget, 1) : 0;
              const label = assignLabel(k);
              return (
                <li key={k.id} className="rounded-xl border border-border bg-surface-2 p-3.5">
                  <div className="flex items-center gap-3">
                    <span className="inline-block h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: providerColor(k.provider) }} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{k.label}</p>
                      <p className="text-xs text-subtle">
                        {providerLabel(k.provider)}
                        {k.base_url && (<> · <span className="font-mono">{k.base_url}</span></>)}
                        {" · "}added {new Date(k.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="hidden font-mono text-xs text-subtle sm:inline">sk-••••••••</span>
                    <button onClick={() => deleteKey(k.id)} disabled={deleting === k.id} className="shrink-0 rounded px-2 py-1 text-xs text-danger opacity-60 transition-opacity hover:opacity-100 disabled:opacity-30 cursor-pointer">
                      {deleting === k.id ? "…" : "Remove"}
                    </button>
                  </div>
                  {budget != null && (
                    <div className="mt-2.5">
                      <div className="flex items-baseline justify-between text-[11px]">
                        <span className="text-muted">{usd(usdFromTokens(Math.max(budget - spent, 0)), { cents: true })} left this cap</span>
                        <span className="tnum font-mono text-subtle">{Math.round(ratio * 100)}%</span>
                      </div>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface">
                        <div className={`h-full rounded-full ${ratio >= 1 ? "bg-danger" : ratio >= 0.8 ? "bg-warning" : "bg-gold"}`} style={{ width: `${ratio * 100}%` }} />
                      </div>
                    </div>
                  )}
                  {/* Delegation to a department */}
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${label.gold ? "bg-gold-soft text-gold" : "bg-surface text-subtle"}`}>
                      {label.text}
                    </span>
                    <label className="ml-auto flex items-center gap-1.5 text-[11px] text-subtle">
                      Delegate to
                      <select
                        value={assignValue(k)}
                        disabled={assigningId === k.id}
                        onChange={(e) => assign(k.id, e.target.value)}
                        className="h-7 rounded-lg border border-border-strong bg-surface px-2 text-[11px] outline-none focus:border-gold/50 disabled:opacity-50 cursor-pointer"
                      >
                        <option value="shared">Whole workspace (shared)</option>
                        {departments.length > 0 && (
                          <optgroup label="A department">
                            {departments.map((d) => <option key={d.id} value={`department:${d.id}`}>{d.name}</option>)}
                          </optgroup>
                        )}
                      </select>
                    </label>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="mt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">Get API keys</p>
        <div className="grid gap-3 sm:grid-cols-3">
          {API_KEY_SOURCES.map((src) => (
            <a key={src.key} href={src.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2.5 rounded-xl border border-border bg-surface-2 p-3 transition-colors hover:border-gold/40">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: src.color }} />
              <span className="min-w-0 flex-1 text-sm font-medium">{src.label}</span>
              <span className="shrink-0 text-xs text-muted">Get key ↗</span>
            </a>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-subtle">
          Keys are encrypted at rest and never leave your server. Delegate a key to a department so no
          single key serves your whole institution.
        </p>
      </div>
    </section>
  );
}

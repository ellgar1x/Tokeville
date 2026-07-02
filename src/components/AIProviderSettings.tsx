"use client";

import { useEffect, useState } from "react";
import { PROVIDERS, ProviderKey } from "@/lib/models";
import { tok, usd, usdFromTokens } from "@/lib/format";

interface StoredKey {
  id: string;
  provider: string;
  label: string;
  base_url?: string | null;
  budget_tokens?: number | null;
  spent_tokens?: number | null;
  owner_user_id?: string | null;
  created_at: string;
}

const API_KEY_SOURCES = [
  {
    key: "anthropic",
    label: "Anthropic",
    color: "#cc785c",
    pricing: "Pay-as-you-go · Claude models",
    url: "https://console.anthropic.com/settings/keys",
  },
  {
    key: "openai",
    label: "OpenAI",
    color: "#10a37f",
    pricing: "Pay-as-you-go · GPT-4o, o1, o3",
    url: "https://platform.openai.com/api-keys",
  },
  {
    key: "google",
    label: "Google AI Studio",
    color: "#4285f4",
    pricing: "Free tier available · Gemini models",
    url: "https://aistudio.google.com/app/apikey",
  },
  {
    key: "mistral",
    label: "Mistral AI",
    color: "#f97316",
    pricing: "Pay-as-you-go · Mistral models",
    url: "https://console.mistral.ai/api-keys/",
  },
];

const PROVIDER_OPTIONS: { key: ProviderKey; label: string; color: string; placeholder: string; needsUrl?: boolean }[] =
  [
    { key: "anthropic", label: "Anthropic", color: "#cc785c", placeholder: "sk-ant-…" },
    { key: "openai", label: "OpenAI", color: "#10a37f", placeholder: "sk-…" },
    { key: "google", label: "Google AI", color: "#4285f4", placeholder: "AIza…" },
    {
      key: "custom",
      label: "Custom / OpenAI-compatible",
      color: "#888",
      placeholder: "sk-… or any key",
      needsUrl: true,
    },
  ];

export function AIProviderSettings() {
  const [keys, setKeys] = useState<StoredKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [form, setForm] = useState<{
    provider: ProviderKey;
    label: string;
    apiKey: string;
    baseUrl: string;
    budgetUsd: string;
  }>({ provider: "openai", label: "OpenAI", apiKey: "", baseUrl: "", budgetUsd: "" });
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/provider-keys")
      .then((r) => r.json())
      .then((d) => { setKeys(d.keys ?? []); setCurrentUserId(d.currentUserId ?? null); })
      .finally(() => setLoading(false));
  }, []);

  const selectedProviderOption = PROVIDER_OPTIONS.find((p) => p.key === form.provider)!;

  async function addKey() {
    setError(null);
    if (!form.apiKey.trim()) { setError("API key is required."); return; }
    if (selectedProviderOption.needsUrl && !form.baseUrl.trim()) {
      setError("Base URL is required for custom providers.");
      return;
    }
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
    setForm({ provider: "openai", label: "OpenAI", apiKey: "", baseUrl: "", budgetUsd: "" });
    setShowForm(false);
    setSuccess("API key saved.");
    setTimeout(() => setSuccess(null), 3000);
  }

  async function deleteKey(id: string) {
    setDeleting(id);
    await fetch(`/api/provider-keys?id=${id}`, { method: "DELETE" });
    setKeys((prev) => prev.filter((k) => k.id !== id));
    setDeleting(null);
  }

  const inputClass =
    "h-10 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm outline-none transition-colors duration-200 placeholder:text-subtle focus:border-gold/50 focus:ring-2 focus:ring-gold/15";

  const providerColor = (key: string) =>
    PROVIDER_OPTIONS.find((p) => p.key === key)?.color ??
    PROVIDERS.find((p) => p.key === key)?.color ??
    "#888";

  const providerLabel = (key: string) =>
    PROVIDER_OPTIONS.find((p) => p.key === key)?.label ??
    PROVIDERS.find((p) => p.key === key)?.label ??
    key;

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)] sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-sm font-semibold tracking-tight">AI Providers</h2>
          <p className="mt-0.5 text-xs text-subtle">
            Add API keys to unlock models in chat. Keys are stored server-side and never
            sent to the browser.
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

      {/* Add form */}
      {showForm && (
        <div className="mt-5 space-y-3 rounded-xl border border-border-strong bg-surface-2 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-subtle">New API key</p>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-subtle">Provider</label>
              <select
                value={form.provider}
                onChange={(e) => {
                  const p = e.target.value as ProviderKey;
                  setForm((f) => ({
                    ...f,
                    provider: p,
                    label: PROVIDER_OPTIONS.find((o) => o.key === p)?.label ?? p,
                  }));
                }}
                className="h-10 w-full rounded-lg border border-border-strong bg-surface px-3 text-sm outline-none focus:border-gold/50 cursor-pointer"
              >
                {PROVIDER_OPTIONS.map((p) => (
                  <option key={p.key} value={p.key}>{p.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-subtle">Label</label>
              <input
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
                placeholder="e.g. Production OpenAI"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-subtle">API key</label>
              <input
                type="password"
                value={form.apiKey}
                onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
                placeholder={selectedProviderOption.placeholder}
                autoComplete="off"
                className={inputClass}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-subtle">Monthly budget (optional)</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">$</span>
                <input
                  value={form.budgetUsd}
                  onChange={(e) => setForm((f) => ({ ...f, budgetUsd: e.target.value.replace(/[^0-9.]/g, "") }))}
                  placeholder="No cap"
                  inputMode="decimal"
                  className={`${inputClass} pl-7 font-mono`}
                />
              </div>
            </div>
          </div>

          {selectedProviderOption.needsUrl && (
            <div>
              <label className="mb-1 block text-xs font-medium text-subtle">
                Base URL <span className="text-danger">*</span>
              </label>
              <input
                value={form.baseUrl}
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                placeholder="https://api.your-provider.com/v1"
                className={inputClass}
              />
              <p className="mt-1 text-[11px] text-subtle">
                Any OpenAI-compatible endpoint works (Ollama, Together, Groq, LM Studio, etc.)
              </p>
            </div>
          )}

          {error && (
            <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              onClick={addKey}
              disabled={adding}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-b from-gold-bright to-gold px-4 text-xs font-semibold text-[#0a0a0b] shadow-[0_1px_8px_rgba(232,184,95,0.25)] transition-all duration-200 hover:from-gold hover:to-gold-deep disabled:opacity-40 cursor-pointer"
            >
              {adding ? "Saving…" : "Save key"}
            </button>
            <button
              onClick={() => { setShowForm(false); setError(null); }}
              className="inline-flex h-9 items-center rounded-lg border border-border px-4 text-xs font-medium text-muted transition-colors hover:bg-surface-2 cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {success && (
        <p className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-400">
          {success}
        </p>
      )}

      {/* Keys list */}
      <div className="mt-4">
        {loading ? (
          <p className="text-xs text-subtle">Loading…</p>
        ) : keys.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-8 text-center">
            <p className="text-sm font-medium text-muted">No API keys yet</p>
            <p className="mt-1 text-xs text-subtle">
              Add a key to start chatting with GPT, Gemini, or other models.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {keys.map((k) => {
              const budget = k.budget_tokens ?? null;
              const spent = Number(k.spent_tokens ?? 0);
              const ratio = budget && budget > 0 ? Math.min(spent / budget, 1) : 0;
              const over = budget != null && spent >= budget;
              const barColor = over ? "bg-danger" : ratio >= 0.8 ? "bg-warning" : "bg-gold";
              const isMine = !!currentUserId && k.owner_user_id === currentUserId;
              return (
                <li key={k.id} className="rounded-xl border border-border bg-surface-2 p-3.5">
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: providerColor(k.provider) }}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {k.label}
                        <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${isMine ? "bg-gold-soft text-gold" : "bg-surface text-subtle"}`}>
                          {isMine ? "You" : "Workspace"}
                        </span>
                      </p>
                      <p className="text-xs text-subtle">
                        {providerLabel(k.provider)}
                        {k.base_url && (<> · <span className="font-mono">{k.base_url}</span></>)}
                        {" · "}added {new Date(k.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <span className="font-mono text-xs text-subtle">sk-••••••••</span>
                    <button
                      onClick={() => deleteKey(k.id)}
                      disabled={deleting === k.id}
                      className="shrink-0 rounded px-2 py-1 text-xs text-danger opacity-60 transition-opacity hover:opacity-100 disabled:opacity-30 cursor-pointer"
                    >
                      {deleting === k.id ? "…" : "Remove"}
                    </button>
                  </div>

                  {/* Per-key budget */}
                  <div className="mt-3">
                    {budget != null ? (
                      <>
                        <div className="flex items-baseline justify-between text-[11px]">
                          <span className={over ? "font-medium text-danger" : "text-muted"}>
                            {over ? "Budget used up" : `${usd(usdFromTokens(Math.max(budget - spent, 0)), { cents: true })} left`}
                          </span>
                          <span className="tnum font-mono text-subtle">
                            {tok(spent)} / {tok(budget)} · {Math.round(ratio * 100)}%
                          </span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface">
                          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${ratio * 100}%` }} />
                        </div>
                      </>
                    ) : (
                      <p className="text-[11px] text-subtle">
                        No budget cap · {tok(spent)} spent so far
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Get API Keys marketplace */}
      <div className="mt-6">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">
          Get API keys
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {API_KEY_SOURCES.map((src) => (
            <div
              key={src.key}
              className="flex items-start gap-3 rounded-xl border border-border bg-surface-2 p-3.5"
            >
              <span
                className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: src.color }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{src.label}</p>
                <p className="mt-0.5 text-[11px] text-subtle">{src.pricing}</p>
              </div>
              <a
                href={src.url}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 inline-flex h-8 items-center gap-1 rounded-lg border border-border-strong bg-surface px-3 text-xs font-medium text-muted transition-colors hover:border-gold/40 hover:text-gold"
              >
                Get key ↗
              </a>
            </div>
          ))}
        </div>
        <p className="mt-3 text-[11px] text-subtle">
          Paste your key into the form above — it's encrypted at rest and never leaves your server.
        </p>
      </div>

      {/* Model coverage */}
      <div className="mt-5 rounded-xl border border-border bg-surface-2 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">
          Available models by provider
        </p>
        <div className="space-y-2">
          {PROVIDERS.map((p) => {
            const hasKey = keys.some((k) => k.provider === p.key);
            return (
              <div key={p.key} className="flex items-start gap-3">
                <span
                  className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full"
                  style={{ background: p.color, opacity: hasKey ? 1 : 0.3 }}
                />
                <div className="min-w-0">
                  <p className={`text-xs font-semibold ${hasKey ? "" : "text-subtle"}`}>
                    {p.label}
                    {hasKey && (
                      <span className="ml-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-1 py-0.5 text-[10px] font-medium text-emerald-400">
                        active
                      </span>
                    )}
                  </p>
                  <p className="mt-0.5 text-[11px] text-subtle">
                    {p.models.map((m) => m.label).join(", ")}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

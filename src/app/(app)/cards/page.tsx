"use client";

import { useEffect, useState } from "react";
import { useDemo } from "@/store/demo";
import { tok } from "@/lib/format";
import { CardIcon, PlusIcon, TokevilleMark, CheckIcon } from "@/components/icons";

interface KeyRow {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export default function CardsPage() {
  const { state, notify } = useDemo();
  const [frozen, setFrozen] = useState(false);
  const [keys, setKeys] = useState<KeyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [justCreated, setJustCreated] = useState<{ secret: string; name: string } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetch("/api/keys").then((r) => r.json()).then((d) => setKeys(d.keys ?? [])).finally(() => setLoading(false));
  }, []);

  async function createKey() {
    setCreating(true);
    const res = await fetch("/api/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName.trim() || undefined }),
    });
    const data = await res.json();
    setCreating(false);
    if (!res.ok) { notify("Couldn't create key", data.error ?? "Try again", "danger"); return; }
    setKeys((prev) => [data.key, ...prev]);
    setJustCreated({ secret: data.secret, name: data.key.name });
    setCopied(false);
    setNewName("");
  }

  async function revokeKey(id: string) {
    const res = await fetch(`/api/keys?id=${id}`, { method: "DELETE" });
    if (res.ok) {
      setKeys((prev) => prev.map((k) => (k.id === id ? { ...k, revoked_at: new Date().toISOString() } : k)));
      notify("Key revoked", "It can no longer make requests", "danger");
    }
  }

  async function copy(text: string, msg = "API key copied") {
    try { await navigator.clipboard.writeText(text); notify("Copied", msg); } catch { notify("Couldn't copy", "Clipboard unavailable", "danger"); }
  }

  const gatewayUrl = typeof window !== "undefined" ? `${window.location.origin}/api/gateway` : "/api/gateway";
  const activeKeys = keys.filter((k) => !k.revoked_at);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Virtual card */}
        <section className="lg:col-span-2">
          <h2 className="mb-3 text-sm font-semibold tracking-tight">Spend card</h2>
          <div
            className={`gold-edge relative aspect-[1.6/1] overflow-hidden rounded-2xl border border-border-strong bg-gradient-to-br from-[#1a1a1d] to-[#0b0b0d] p-5 shadow-[0_2px_24px_rgba(0,0,0,0.5)] transition-opacity duration-300 text-white ${frozen ? "opacity-60" : ""}`}
          >
            <div className="flex items-start justify-between">
              <TokevilleMark className="h-9 w-9" />
              <span className="text-xs font-medium uppercase tracking-widest text-gold">{frozen ? "Frozen" : "Virtual"}</span>
            </div>
            <p className="tnum mt-7 font-mono text-lg tracking-[0.2em] text-white/90">8841 •••• •••• 4242</p>
            <div className="mt-4 flex items-end justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-white/50">Card holder</p>
                <p className="text-sm font-medium text-white">{state.profile.displayName || "Tokeville User"}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-white/50">Limit</p>
                <p className="tnum font-mono text-sm font-medium text-gold">{tok(state.wallet.balanceTokens)}/mo</p>
              </div>
            </div>
          </div>
          <button
            onClick={() => { setFrozen(!frozen); notify(frozen ? "Card unfrozen" : "Card frozen", frozen ? "Spending re-enabled" : "Spending paused", frozen ? "positive" : "danger"); }}
            className="mt-3 inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-border-strong bg-surface-2 text-sm font-medium text-foreground transition-colors duration-200 hover:border-gold/40 hover:text-gold cursor-pointer"
          >
            {frozen ? "Unfreeze card" : "Freeze card"}
          </button>
        </section>

        {/* API keys */}
        <section className="lg:col-span-3 rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
          <div className="flex items-center justify-between gap-4 px-6 py-5">
            <div>
              <h2 className="flex items-center gap-2 text-sm font-semibold tracking-tight">
                <CardIcon className="h-4 w-4 text-gold" />
                Your Tokeville API keys
              </h2>
              <p className="mt-0.5 text-xs text-subtle">
                Your own key — usage runs on Tokeville&apos;s models and spends your tokens. No provider account needed.
              </p>
            </div>
          </div>

          {/* Create */}
          <div className="flex flex-wrap items-center gap-2 border-t border-border px-6 py-4">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Key name (e.g. Production)"
              className="h-9 min-w-0 flex-1 rounded-lg border border-border-strong bg-surface-2 px-3 text-sm outline-none focus:border-gold/50"
            />
            <button
              onClick={createKey}
              disabled={creating}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-b from-gold-bright to-gold px-3.5 text-sm font-semibold text-[#0a0a0b] shadow-[0_1px_8px_rgba(232,184,95,0.25)] transition-all duration-200 hover:from-gold hover:to-gold-deep disabled:opacity-50 cursor-pointer"
            >
              <PlusIcon className="h-4 w-4" />
              {creating ? "Creating…" : "Create key"}
            </button>
          </div>

          {/* One-time reveal of the new secret */}
          {justCreated && (
            <div className="mx-6 mb-4 rounded-xl border border-gold/30 bg-gold-soft p-4">
              <p className="text-xs font-semibold text-gold">Copy your key now — you won&apos;t see it again</p>
              <div className="mt-2 flex items-center gap-2">
                <code className="min-w-0 flex-1 truncate rounded-lg border border-border-strong bg-background/60 px-3 py-2 font-mono text-xs">{justCreated.secret}</code>
                <button
                  onClick={() => { copy(justCreated.secret); setCopied(true); }}
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg bg-gradient-to-b from-gold-bright to-gold px-3 text-xs font-semibold text-[#0a0a0b] cursor-pointer"
                >
                  {copied ? <><CheckIcon className="h-3.5 w-3.5" /> Copied</> : "Copy"}
                </button>
              </div>
              <button onClick={() => setJustCreated(null)} className="mt-2 text-[11px] text-subtle hover:text-foreground cursor-pointer">Done — hide it</button>
            </div>
          )}

          <ul className="border-t border-border">
            {loading ? (
              <li className="px-6 py-10 text-center text-sm text-subtle">Loading…</li>
            ) : keys.length === 0 ? (
              <li className="px-6 py-10 text-center text-sm text-subtle">No API keys yet. Create one to start making requests.</li>
            ) : (
              keys.map((k) => {
                const revoked = !!k.revoked_at;
                return (
                  <li key={k.id} className={`flex flex-wrap items-center gap-3 border-b border-border px-6 py-4 last:border-b-0 ${revoked ? "opacity-50" : "hover:bg-surface-2"}`}>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        {k.name}
                        {revoked && <span className="rounded-full bg-danger-soft px-1.5 py-0.5 text-[10px] font-medium text-danger">Revoked</span>}
                      </p>
                      <p className="tnum mt-0.5 font-mono text-xs text-subtle">{k.key_prefix}{"•".repeat(18)}</p>
                      <p className="mt-0.5 text-[11px] text-subtle">
                        Created {new Date(k.created_at).toLocaleDateString()}
                        {k.last_used_at ? ` · last used ${new Date(k.last_used_at).toLocaleDateString()}` : " · never used"}
                      </p>
                    </div>
                    {!revoked && (
                      <button
                        onClick={() => revokeKey(k.id)}
                        className="h-8 rounded-lg border border-border-strong bg-surface px-3 text-xs font-medium text-muted transition-colors duration-200 hover:border-danger/40 hover:text-danger cursor-pointer"
                      >
                        Revoke
                      </button>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        </section>
      </div>

      {/* Quick-start — how to actually spend with the key */}
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
        <h2 className="text-sm font-semibold tracking-tight">Start spending with your key</h2>
        <p className="mt-0.5 text-xs text-subtle">
          Tokeville is OpenAI-compatible. Point any OpenAI SDK or tool at the gateway below and use your key — every
          call runs on Tokeville&apos;s models and draws down your token balance ({tok(state.wallet.balanceTokens)} available).
          {activeKeys.length === 0 && " Create a key above to begin."}
        </p>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle">Base URL</p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-lg border border-border-strong bg-surface-2 px-3 py-2 font-mono text-xs">{gatewayUrl}</code>
              <button onClick={() => copy(gatewayUrl, "Base URL copied")} className="h-8 shrink-0 rounded-lg border border-border-strong bg-surface px-3 text-xs font-medium text-muted hover:border-gold/40 hover:text-gold cursor-pointer">Copy</button>
            </div>
            <p className="mt-1.5 text-[11px] text-subtle">Auth header: <span className="font-mono">Authorization: Bearer sk-tok-…</span></p>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-subtle">cURL</p>
            <pre className="scroll-thin overflow-x-auto rounded-lg border border-border-strong bg-[#0d1117] px-3 py-2.5 text-[11px] leading-relaxed">{`curl ${gatewayUrl}/chat/completions \\
  -H "Authorization: Bearer $TOKEVILLE_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"model":"claude-sonnet-4-6",
       "messages":[{"role":"user","content":"Hello"}]}'`}</pre>
          </div>
        </div>
      </section>
    </div>
  );
}

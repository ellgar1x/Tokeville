"use client";

import { useState } from "react";
import { useDemo } from "@/store/demo";
import { tok } from "@/lib/format";
import { CardIcon, PlusIcon, TokevilleMark } from "@/components/icons";

interface ApiKey {
  id: string;
  name: string;
  token: string;
  created: string;
  revealed: boolean;
}

function genKey() {
  const hex = Array.from({ length: 24 }, () =>
    Math.floor(Math.random() * 16).toString(16),
  ).join("");
  return `sk_live_${hex}`;
}

function mask(token: string) {
  return `${token.slice(0, 11)}${"•".repeat(16)}${token.slice(-4)}`;
}

export default function CardsPage() {
  const { state, notify } = useDemo();
  const [frozen, setFrozen] = useState(false);
  const [keys, setKeys] = useState<ApiKey[]>([
    {
      id: "k1",
      name: "Production key",
      token: "sk_live_8f2a1c9b4e7d6a3f1029bce4",
      created: "Created Jun 12, 2026",
      revealed: false,
    },
    {
      id: "k2",
      name: "Staging key",
      token: "sk_live_2b7e4419ac0d83f5e61790ab",
      created: "Created May 28, 2026",
      revealed: false,
    },
  ]);

  function createKey() {
    const k: ApiKey = {
      id: `k-${Date.now()}`,
      name: `API key ${keys.length + 1}`,
      token: genKey(),
      created: "Created just now",
      revealed: true,
    };
    setKeys([k, ...keys]);
    notify("API key created", "Copy it now — it won't be shown in full again", "gold");
  }

  async function copyKey(token: string) {
    try {
      await navigator.clipboard.writeText(token);
      notify("Copied to clipboard", "API key copied");
    } catch {
      notify("Couldn't copy", "Clipboard is unavailable", "danger");
    }
  }

  function revokeKey(id: string) {
    setKeys(keys.filter((k) => k.id !== id));
    notify("Key revoked", "The API key can no longer be used", "danger");
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
      {/* Virtual card */}
      <section className="lg:col-span-2">
        <h2 className="mb-3 text-sm font-semibold tracking-tight">Spend card</h2>
        <div
          className={`gold-edge relative aspect-[1.6/1] overflow-hidden rounded-2xl border border-border-strong bg-gradient-to-br from-[#1a1a1d] to-[#0b0b0d] p-5 shadow-[0_2px_24px_rgba(0,0,0,0.5)] transition-opacity duration-300 text-white ${frozen ? "opacity-60" : ""}`}
        >
          <div className="flex items-start justify-between">
            <TokevilleMark className="h-9 w-9" />
            <span className="text-xs font-medium uppercase tracking-widest text-gold">
              {frozen ? "Frozen" : "Virtual"}
            </span>
          </div>
          <p className="tnum mt-7 font-mono text-lg tracking-[0.2em] text-white/90">
            8841 •••• •••• 4242
          </p>
          <div className="mt-4 flex items-end justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-wide text-white/50">Card holder</p>
              <p className="text-sm font-medium text-white">
                {state.profile.displayName || "Tokeville User"}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-white/50">Limit</p>
              <p className="tnum font-mono text-sm font-medium text-gold">
                {tok(state.wallet.balanceTokens)}/mo
              </p>
            </div>
          </div>
        </div>
        <button
          onClick={() => {
            setFrozen(!frozen);
            notify(frozen ? "Card unfrozen" : "Card frozen", frozen ? "Spending re-enabled" : "Spending paused", frozen ? "positive" : "danger");
          }}
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
              API keys
            </h2>
            <p className="mt-0.5 text-xs text-subtle">
              Authenticate requests that spend from your treasury
            </p>
          </div>
          <button
            onClick={createKey}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-b from-gold-bright to-gold px-3.5 text-sm font-semibold text-[#0a0a0b] shadow-[0_1px_8px_rgba(232,184,95,0.25)] transition-all duration-200 hover:from-gold hover:to-gold-deep cursor-pointer"
          >
            <PlusIcon className="h-4 w-4" />
            <span className="hidden sm:inline">Create key</span>
          </button>
        </div>

        <ul className="border-t border-border">
          {keys.length === 0 && (
            <li className="px-6 py-10 text-center text-sm text-subtle">
              No API keys. Create one to start making requests.
            </li>
          )}
          {keys.map((k) => (
            <li
              key={k.id}
              className="flex flex-wrap items-center gap-3 border-b border-border px-6 py-4 last:border-b-0 hover:bg-surface-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{k.name}</p>
                <p className="tnum mt-0.5 font-mono text-xs text-subtle">
                  {k.revealed ? k.token : mask(k.token)}
                </p>
                <p className="mt-0.5 text-[11px] text-subtle">{k.created}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => copyKey(k.token)}
                  className="h-8 rounded-lg border border-border-strong bg-surface px-3 text-xs font-medium text-muted transition-colors duration-200 hover:border-gold/40 hover:text-gold cursor-pointer"
                >
                  Copy
                </button>
                <button
                  onClick={() => revokeKey(k.id)}
                  className="h-8 rounded-lg border border-border-strong bg-surface px-3 text-xs font-medium text-muted transition-colors duration-200 hover:border-danger/40 hover:text-danger cursor-pointer"
                >
                  Revoke
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

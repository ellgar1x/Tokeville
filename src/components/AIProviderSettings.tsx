"use client";

import { useEffect, useState } from "react";
import { PROVIDERS } from "@/lib/models";

export function AIProviderSettings() {
  const [active, setActive] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/providers/available")
      .then((r) => r.json())
      .then((d) => setActive(d.providers ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)] sm:p-7">
      <div>
        <h2 className="text-sm font-semibold tracking-tight">AI Models</h2>
        <p className="mt-0.5 text-xs text-subtle">
          Your tokens run on <span className="font-medium text-foreground">Tokeville&apos;s own keys</span> — no
          provider accounts, no API keys to manage. Every model below is metered against your treasury and project
          budgets automatically. Want a provider that isn&apos;t live yet? Ask us to enable it.
        </p>
      </div>

      <div className="mt-5 rounded-xl border border-border bg-surface-2 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-subtle">
          Available models by provider
        </p>
        {loading ? (
          <p className="text-xs text-subtle">Loading…</p>
        ) : (
          <div className="space-y-2">
            {PROVIDERS.map((p) => {
              const hasKey = active.includes(p.key);
              return (
                <div key={p.key} className="flex items-start gap-3">
                  <span
                    className="mt-0.5 inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: p.color, opacity: hasKey ? 1 : 0.3 }}
                  />
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold ${hasKey ? "" : "text-subtle"}`}>
                      {p.label}
                      {hasKey ? (
                        <span className="ml-1.5 rounded border border-emerald-500/30 bg-emerald-500/10 px-1 py-0.5 text-[10px] font-medium text-emerald-400">
                          active
                        </span>
                      ) : (
                        <span className="ml-1.5 rounded border border-border-strong px-1 py-0.5 text-[10px] font-medium text-subtle">
                          not yet enabled
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
        )}
      </div>
    </section>
  );
}

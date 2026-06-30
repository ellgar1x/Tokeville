"use client";

import { useState } from "react";
import { useDemo } from "@/store/demo";
import { pct, tok, tokAmount, usd, usdFromTokens } from "@/lib/format";
import { SpendByModel } from "@/components/SpendByModel";
import {
  ArrowDownLeftIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ShieldIcon,
} from "@/components/icons";

const RANGES = ["7 days", "30 days", "90 days"] as const;

export default function SpendPage() {
  const { state } = useDemo();
  const [range, setRange] = useState<(typeof RANGES)[number]>("30 days");

  const totalProviderTokens = state.providers.reduce((s, p) => s + p.tokens, 0);
  const rankedAccounts = [...state.accounts].sort((a, b) => b.tokensUsed - a.tokensUsed);
  const maxUsed = rankedAccounts[0]?.tokensUsed || 1;

  function exportCsv() {
    const rows = [
      ["Type", "Name", "Detail", "Tokens", "USD (approx)", "Change MoM"],
      ...state.providers.map((p) => [
        "Provider",
        p.name,
        p.models,
        String(p.tokens),
        usdFromTokens(p.tokens).toFixed(2),
        `${(p.changeMoM * 100).toFixed(1)}%`,
      ]),
      ...state.accounts.map((a) => [
        "Account",
        a.name,
        `${a.type} · ${a.owner}`,
        String(a.tokensUsed),
        usdFromTokens(a.tokensUsed).toFixed(2),
        "",
      ]),
    ];
    const csv = rows
      .map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `tokeville-spend-${range.replace(" ", "")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-lg border border-border bg-surface-2 p-0.5">
          {RANGES.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded-[7px] px-3 py-1.5 text-xs font-medium transition-colors duration-200 cursor-pointer ${
                range === r ? "bg-elevated text-foreground shadow-sm" : "text-subtle hover:text-foreground"
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <button
          onClick={exportCsv}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-surface-2 px-3.5 text-sm font-medium text-foreground transition-colors duration-200 hover:border-gold/40 hover:text-gold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
        >
          <ArrowDownLeftIcon className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SpendByModel />

        <section className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)] sm:p-7">
          <div className="flex items-baseline justify-between">
            <h2 className="text-sm font-semibold tracking-tight">Spend by account</h2>
            <span className="text-xs text-subtle">{range}</span>
          </div>
          <ul className="mt-5 space-y-4">
            {rankedAccounts.map((a) => (
              <li key={a.id}>
                <div className="flex items-baseline justify-between text-sm">
                  <span className="font-medium">{a.name}</span>
                  <span className="tnum font-mono font-semibold">{tok(a.tokensUsed)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-3">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div
                      className="h-full rounded-full bg-gold transition-[width] duration-500"
                      style={{ width: `${(a.tokensUsed / maxUsed) * 100}%` }}
                    />
                  </div>
                  <span className="tnum w-16 text-right text-xs text-subtle">
                    ≈ {usd(usdFromTokens(a.tokensUsed))}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
        <div className="px-6 py-5 sm:px-7">
          <h2 className="text-sm font-semibold tracking-tight">Provider detail</h2>
          <p className="mt-0.5 text-xs text-subtle">
            Token consumption across every connected provider
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-t border-border text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-subtle">
                <th className="px-6 py-3 font-medium sm:px-7">Provider</th>
                <th className="px-6 py-3 font-medium">Tokens</th>
                <th className="px-6 py-3 font-medium">≈ USD</th>
                <th className="px-6 py-3 font-medium">Share</th>
                <th className="px-6 py-3 text-right font-medium sm:px-7">MoM</th>
              </tr>
            </thead>
            <tbody>
              {state.providers.map((p) => {
                const up = p.changeMoM >= 0;
                return (
                  <tr key={p.id} className="border-t border-border hover:bg-surface-2">
                    <td className="px-6 py-4 sm:px-7">
                      <div className="flex items-center gap-3">
                        <span
                          className="h-2.5 w-2.5 rounded-full"
                          style={{ backgroundColor: p.color }}
                        />
                        <div>
                          <div className="flex items-center gap-1.5 font-medium">
                            {p.name}
                            {p.isCustom && (
                              <span className="inline-flex items-center gap-0.5 rounded-full border border-gold/20 bg-gold-soft px-1.5 py-0.5 text-[9px] font-medium text-gold">
                                <ShieldIcon className="h-2.5 w-2.5" /> Internal
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-subtle">{p.models}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 tnum font-mono">{tok(p.tokens)}</td>
                    <td className="px-6 py-4 tnum text-muted">
                      {usd(usdFromTokens(p.tokens), { cents: true })}
                    </td>
                    <td className="px-6 py-4 tnum text-muted">
                      {pct((p.tokens / totalProviderTokens) * 100)}
                    </td>
                    <td className="px-6 py-4 text-right sm:px-7">
                      <span
                        className={`tnum inline-flex items-center gap-0.5 text-xs ${up ? "text-warning" : "text-positive"}`}
                      >
                        {up ? (
                          <ArrowUpIcon className="h-3 w-3" />
                        ) : (
                          <ArrowDownIcon className="h-3 w-3" />
                        )}
                        {pct(Math.abs(p.changeMoM * 100))}
                      </span>
                    </td>
                  </tr>
                );
              })}
              <tr className="border-t border-border-strong font-medium">
                <td className="px-6 py-4 sm:px-7">Total</td>
                <td className="px-6 py-4 tnum font-mono gold-text">
                  Ŧ{tokAmount(totalProviderTokens)}
                </td>
                <td className="px-6 py-4 tnum" colSpan={3}>
                  {usd(usdFromTokens(totalProviderTokens), { cents: true })}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

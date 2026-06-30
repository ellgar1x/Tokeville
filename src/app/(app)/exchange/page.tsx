"use client";

import { useState } from "react";
import { useDemo } from "@/store/demo";
import { type ProviderId } from "@/lib/data";
import { tok, usd, USD_PER_MILLION_TOKENS } from "@/lib/format";
import { Sparkline } from "@/components/Sparkline";
import { ArrowUpIcon, CoinsIcon, ExchangeIcon, PlusIcon } from "@/components/icons";

// Illustrative effective rates — what 1M tokens costs through each provider's
// flagship models. Reinforces tokens as a currency with provider "FX" rates.
const PROVIDER_RATES: { key: ProviderId; name: string; model: string; rate: number }[] = [
  { key: "anthropic", name: "Anthropic", model: "Claude Opus 4.8", rate: 12.5 },
  { key: "openai", name: "OpenAI", model: "GPT-5.1", rate: 10.0 },
  { key: "google", name: "Google", model: "Gemini 2.5 Pro", rate: 7.0 },
  { key: "other", name: "Open models", model: "Mistral · OpenRouter", rate: 5.0 },
];

const COLOR: Record<ProviderId, string> = {
  anthropic: "var(--anthropic)",
  openai: "var(--openai)",
  google: "var(--google)",
  other: "var(--other)",
};

const RATE_SERIES = [9.7, 9.8, 9.75, 9.9, 10.05, 9.95, 10.1, 10.0, 9.9, 10.0, 10.05, 10.0];

export default function ExchangePage() {
  const { openModal } = useDemo();
  const [usdStr, setUsdStr] = useState("5000");
  const [tokMStr, setTokMStr] = useState("500");

  function onUsd(v: string) {
    const clean = v.replace(/[^0-9.]/g, "");
    setUsdStr(clean);
    const n = parseFloat(clean) || 0;
    setTokMStr(String(+(n / USD_PER_MILLION_TOKENS).toFixed(2)));
  }
  function onTok(v: string) {
    const clean = v.replace(/[^0-9.]/g, "");
    setTokMStr(clean);
    const n = parseFloat(clean) || 0;
    setUsdStr(String(+(n * USD_PER_MILLION_TOKENS).toFixed(2)));
  }

  const fieldClass =
    "h-12 w-full rounded-lg border border-border-strong bg-surface pl-8 pr-14 text-lg tnum font-mono outline-none transition-colors duration-200 focus:border-gold/50 focus:ring-2 focus:ring-gold/15";

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Rate card */}
        <section className="gold-edge overflow-hidden rounded-2xl border border-border-strong bg-gradient-to-b from-surface to-background p-6 shadow-[0_2px_24px_rgba(0,0,0,0.4)] sm:p-7 lg:col-span-3">
          <div className="flex items-center gap-2 text-sm font-medium text-muted">
            <CoinsIcon className="h-4 w-4 text-gold" />
            TOK / USD exchange rate
          </div>
          <div className="mt-3 flex items-end gap-3">
            <p className="tnum gold-text font-mono text-4xl font-semibold tracking-tight">
              {usd(USD_PER_MILLION_TOKENS, { cents: true })}
            </p>
            <span className="mb-1 text-sm text-subtle">per 1M TOK</span>
          </div>
          <p className="mt-1 flex items-center gap-1 text-sm text-positive">
            <ArrowUpIcon className="h-3.5 w-3.5" /> 0.4% past 24h
          </p>
          <div className="mt-5">
            <Sparkline data={RATE_SERIES} className="h-20 w-full" width={560} height={80} id="rate" />
          </div>
        </section>

        {/* Converter */}
        <section className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)] sm:p-7 lg:col-span-2">
          <h2 className="text-sm font-semibold tracking-tight">Convert</h2>
          <p className="mt-0.5 text-xs text-subtle">Value any amount both ways</p>

          <div className="mt-5 space-y-3">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">
                USD
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">
                  $
                </span>
                <input value={usdStr} onChange={(e) => onUsd(e.target.value)} inputMode="decimal" className={fieldClass} />
              </div>
            </div>

            <div className="flex justify-center">
              <span className="flex h-7 w-7 items-center justify-center rounded-full border border-border bg-surface-2 text-gold">
                <ExchangeIcon className="h-3.5 w-3.5 rotate-90" />
              </span>
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">
                TOK (millions)
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-mono text-sm text-gold">
                  Ŧ
                </span>
                <input value={tokMStr} onChange={(e) => onTok(e.target.value)} inputMode="decimal" className={fieldClass} />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-subtle">
                  M
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={() => openModal({ type: "buy" })}
            className="mt-5 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-lg bg-gradient-to-b from-gold-bright to-gold text-sm font-semibold text-[#0a0a0b] shadow-[0_1px_8px_rgba(232,184,95,0.25)] transition-all duration-200 hover:from-gold hover:to-gold-deep cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
          >
            <PlusIcon className="h-4 w-4" />
            Buy TOK
          </button>
        </section>
      </div>

      {/* Provider rates */}
      <section className="rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
        <div className="px-6 py-5 sm:px-7">
          <h2 className="text-sm font-semibold tracking-tight">Provider rates</h2>
          <p className="mt-0.5 text-xs text-subtle">
            What 1M tokens costs through each provider — spend TOK across all of them
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-t border-border text-sm">
            <thead>
              <tr className="text-left text-xs font-medium uppercase tracking-wide text-subtle">
                <th className="px-6 py-3 font-medium sm:px-7">Provider</th>
                <th className="px-6 py-3 font-medium">Flagship model</th>
                <th className="px-6 py-3 font-medium">Rate / 1M TOK</th>
                <th className="px-6 py-3 text-right font-medium sm:px-7">TOK per $1</th>
              </tr>
            </thead>
            <tbody>
              {PROVIDER_RATES.map((p) => (
                <tr key={p.key} className="border-t border-border hover:bg-surface-2">
                  <td className="px-6 py-4 sm:px-7">
                    <div className="flex items-center gap-3">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: COLOR[p.key] }} />
                      <span className="font-medium">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-muted">{p.model}</td>
                  <td className="px-6 py-4 tnum font-mono">{usd(p.rate, { cents: true })}</td>
                  <td className="px-6 py-4 text-right tnum font-mono sm:px-7">
                    {tok((1 / p.rate) * 1_000_000)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

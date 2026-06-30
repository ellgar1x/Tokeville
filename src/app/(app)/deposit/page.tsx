"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { tok, usd, tokensFromCurrency, CURRENCIES, USD_PER_MILLION_TOKENS } from "@/lib/format";

const PLATFORM_FEE_RATE = 0.12;
const PRESETS = [10, 50, 100, 250, 500, 1000];

export default function DepositPage() {
  const router = useRouter();
  const id = useId();
  const [amount, setAmount] = useState("100");
  const [currencyCode, setCurrencyCode] = useState("USD");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const currency = CURRENCIES.find((c) => c.code === currencyCode) ?? CURRENCIES[0];
  const units = Math.max(parseFloat(amount) || 0, 0);
  const dollars = units * currency.usdPerUnit;
  const feeUsd = dollars * PLATFORM_FEE_RATE;
  const netUsd = dollars * (1 - PLATFORM_FEE_RATE);
  const grossTokens = tokensFromCurrency(units, currency);
  const netTokens = Math.round(grossTokens * (1 - PLATFORM_FEE_RATE));
  const valid = units >= 1 && dollars <= 10_000;

  async function handleCheckout() {
    setErr(null);
    setLoading(true);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amountUsd: Math.round(dollars * 100) / 100 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Checkout failed");
      window.location.href = data.url;
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
    }
  }

  const row = (label: string, value: string, subtle = false, large = false) => (
    <div className={`flex items-center justify-between ${subtle ? "text-subtle" : ""}`}>
      <span className={`${large ? "text-sm font-semibold text-foreground" : "text-xs"}`}>{label}</span>
      <span className={`tnum font-mono ${large ? "text-base font-bold text-gold" : "text-xs"}`}>{value}</span>
    </div>
  );

  return (
    <div className="mx-auto max-w-lg space-y-6 pb-16">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Deposit funds</h1>
        <p className="mt-1 text-sm text-subtle">
          Add tokens to your workspace treasury via Stripe. Funds are credited instantly after payment.
        </p>
      </div>

      {/* Amount input */}
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-subtle">Amount</p>

        <div className="flex gap-2">
          <div className="flex-1">
            <label htmlFor={`${id}-amt`} className="mb-1 block text-xs font-medium text-subtle">
              {currency.code} amount
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-subtle">
                {currency.symbol}
              </span>
              <input
                id={`${id}-amt`}
                autoFocus
                inputMode="decimal"
                value={amount}
                onChange={(e) => { setAmount(e.target.value.replace(/[^0-9.]/g, "")); setErr(null); }}
                className={`h-11 w-full rounded-lg border border-border-strong bg-surface-2 px-3 text-sm outline-none transition-colors focus:border-gold/50 focus:ring-2 focus:ring-gold/15 tnum font-mono ${currency.symbol.length > 1 ? "pl-12" : "pl-7"}`}
              />
            </div>
          </div>
          <div className="w-28">
            <label htmlFor={`${id}-cur`} className="mb-1 block text-xs font-medium text-subtle">
              Currency
            </label>
            <select
              id={`${id}-cur`}
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value)}
              className="h-11 w-full cursor-pointer rounded-lg border border-border-strong bg-surface-2 px-2 text-sm outline-none focus:border-gold/50"
            >
              {CURRENCIES.map((c) => (
                <option key={c.code} value={c.code}>{c.code}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Preset chips */}
        <div className="mt-3 flex flex-wrap gap-2">
          {PRESETS.map((v) => (
            <button
              key={v}
              onClick={() => { setAmount(String(v)); setErr(null); }}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                parseFloat(amount) === v
                  ? "border-gold/50 bg-gold-soft text-gold"
                  : "border-border bg-surface-2 text-muted hover:border-gold/30 hover:text-gold"
              }`}
            >
              {currency.symbol}{v.toLocaleString("en-US")}
            </button>
          ))}
        </div>
      </section>

      {/* Fee breakdown — shown before payment */}
      <section className="rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
        <p className="mb-4 text-xs font-semibold uppercase tracking-wide text-subtle">Breakdown</p>
        <div className="space-y-3">
          {row(
            `Deposit (${currency.code !== "USD" ? `${currency.symbol}${units.toLocaleString("en-US")} → ` : ""}${usd(dollars, { cents: true })})`,
            usd(dollars, { cents: true })
          )}
          <div className="flex items-center justify-between text-xs text-subtle">
            <span>Platform fee (12%)</span>
            <span className="tnum font-mono text-danger">− {usd(feeUsd, { cents: true })}</span>
          </div>
          <div className="my-1 border-t border-border" />
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Wallet credit</span>
            <span className="tnum font-mono text-base font-bold text-gold">{usd(netUsd, { cents: true })}</span>
          </div>
          <div className="rounded-xl border border-gold/20 bg-gold-soft px-4 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Tokens credited</span>
              <span className="tnum font-mono text-lg font-bold text-gold">{tok(netTokens)}</span>
            </div>
            <p className="mt-1 text-[11px] text-subtle">
              {currency.code !== "USD" ? `${currency.code} → USD → TOK · ` : ""}
              1M TOK = {usd(USD_PER_MILLION_TOKENS, { cents: true })}
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <div className="space-y-3">
        {err && (
          <p className="rounded-lg border border-danger/30 bg-danger-soft px-3 py-2 text-xs font-medium text-danger">
            {err}
          </p>
        )}
        <button
          onClick={handleCheckout}
          disabled={!valid || loading}
          className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-b from-gold-bright to-gold text-sm font-bold text-[#0a0a0b] shadow-[0_1px_12px_rgba(232,184,95,0.30)] transition-all duration-200 hover:from-gold hover:to-gold-deep disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none cursor-pointer"
        >
          {loading ? (
            "Redirecting to Stripe…"
          ) : valid ? (
            <>
              <StripeLockIcon />
              Pay {usd(dollars, { cents: true })} via Stripe →
            </>
          ) : (
            "Enter a valid amount"
          )}
        </button>
        <button
          onClick={() => router.back()}
          className="w-full text-center text-xs text-subtle hover:text-muted transition-colors cursor-pointer"
        >
          Cancel
        </button>
        <p className="text-center text-[11px] text-subtle">
          Secured by Stripe · test mode · card <span className="tnum font-mono">4242 4242 4242 4242</span>
        </p>
      </div>
    </div>
  );
}

function StripeLockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="shrink-0">
      <path d="M4 6V4a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
      <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
      <circle cx="7" cy="9.5" r="1" fill="currentColor"/>
    </svg>
  );
}

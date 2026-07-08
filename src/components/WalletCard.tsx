"use client";

import Link from "next/link";
import { useDemo } from "@/store/demo";
import {
  pct,
  tok,
  tokAmount,
  TOKEN_TICKER,
  usd,
  usdFromTokens,
} from "@/lib/format";
import { Sparkline } from "./Sparkline";
import { ArrowUpIcon, PlusIcon, SendIcon } from "./icons";

export function WalletCard() {
  const { state, unallocated, openModal } = useDemo();
  const { wallet } = state;
  const up = wallet.change24h >= 0;

  return (
    <section
      aria-labelledby="wallet-heading"
      className="gold-edge overflow-hidden rounded-2xl border border-border-strong bg-gradient-to-b from-surface to-background p-6 shadow-[0_2px_24px_rgba(0,0,0,0.4)] sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-positive" />
            <h2 id="wallet-heading" className="text-sm font-medium text-muted">
              Treasury balance
            </h2>
          </div>

          <div className="mt-2.5 flex items-end gap-2.5">
            <p className="tnum gold-text font-mono text-[2.6rem] font-semibold leading-none tracking-tight sm:text-5xl">
              Ŧ{tokAmount(wallet.balanceTokens)}
            </p>
            <span className="mb-1 rounded-md border border-gold/30 bg-gold-soft px-1.5 py-0.5 font-mono text-[11px] font-semibold text-gold">
              {TOKEN_TICKER}
            </span>
          </div>

          <p className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm text-muted">
            <span className="tnum">≈ {usd(usdFromTokens(wallet.balanceTokens))}</span>
            <span className="text-border-strong">·</span>
            <span
              className={`tnum inline-flex items-center gap-0.5 ${up ? "text-positive" : "text-danger"}`}
            >
              <ArrowUpIcon className="h-3.5 w-3.5" />
              {pct(wallet.change24h * 100, 1)} 24h
            </span>
          </p>
        </div>

        <div className="flex gap-2">
          <Link
            href="/deposit"
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-gradient-to-b from-gold-bright to-gold px-3.5 text-sm font-semibold text-[#0a0a0b] shadow-[0_1px_8px_rgba(232,184,95,0.25)] transition-all duration-200 hover:from-gold hover:to-gold-deep cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/50"
          >
            <PlusIcon className="h-4 w-4" />
            Deposit
          </Link>
          <button
            type="button"
            onClick={() => openModal({ type: "allocate" })}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-surface-2 px-3.5 text-sm font-medium text-foreground transition-colors duration-200 hover:border-gold/40 hover:text-gold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
          >
            <SendIcon className="h-4 w-4" />
            Allocate
          </button>
        </div>
      </div>

      <div className="mt-6 -mx-1">
        <Sparkline
          data={wallet.dailySpend}
          className="h-16 w-full"
          width={640}
          height={64}
          id="wallet-spark"
        />
        <div className="mt-1 flex justify-between px-1 text-[11px] text-subtle">
          <span>Jun 1</span>
          <span>Daily token burn, last 23 days</span>
          <span>Today</span>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-border pt-5 sm:grid-cols-3">
        <Stat
          label="Burned this month"
          value={tok(wallet.monthToDateTokens)}
          sub={
            <span className="tnum">
              ≈ {usd(usdFromTokens(wallet.monthToDateTokens))}
              {wallet.projectedMonthTokens > 0 && (
                <> · {pct((wallet.monthToDateTokens / wallet.projectedMonthTokens) * 100)} of run-rate</>
              )}
            </span>
          }
        />
        <Stat
          label="Allocated"
          value={tok(wallet.allocatedTokens)}
          sub={
            wallet.balanceTokens > 0
              ? `${pct((wallet.allocatedTokens / wallet.balanceTokens) * 100)} of balance committed`
              : "No treasury balance yet"
          }
        />
        <Stat
          label="Unallocated"
          value={tok(unallocated)}
          gold
          sub="Available to budget"
        />
      </dl>
    </section>
  );
}

function Stat({
  label,
  value,
  sub,
  gold,
}: {
  label: string;
  value: string;
  sub: React.ReactNode;
  gold?: boolean;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-subtle">
        {label}
      </dt>
      <dd
        className={`tnum mt-1 font-mono text-lg font-semibold tracking-tight ${gold ? "text-gold" : ""}`}
      >
        {value}
      </dd>
      <dd className="mt-0.5 text-xs text-muted">{sub}</dd>
    </div>
  );
}

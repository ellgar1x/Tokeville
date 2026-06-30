"use client";

import { useDemo } from "@/store/demo";
import {
  pct,
  tok,
  usd,
  USD_PER_MILLION_TOKENS,
} from "@/lib/format";
import {
  ArrowUpIcon,
  ClockIcon,
  CoinsIcon,
  ExchangeIcon,
  FlameIcon,
} from "./icons";

export function Kpis() {
  const { state } = useDemo();
  const { wallet } = state;

  const burn24h = wallet.dailySpend[wallet.dailySpend.length - 1];
  const prev = wallet.dailySpend[wallet.dailySpend.length - 2];
  const burnChange = ((burn24h - prev) / prev) * 100;
  const runwayDays = Math.round(wallet.balanceTokens / burn24h);

  const tiles = [
    {
      label: "Circulating supply",
      icon: CoinsIcon,
      value: tok(wallet.depositedTokens),
      sub: "Minted into treasury all-time",
    },
    {
      label: "Burn rate (24h)",
      icon: FlameIcon,
      value: tok(burn24h),
      sub: (
        <span className="inline-flex items-center gap-0.5 text-warning">
          <ArrowUpIcon className="h-3 w-3" />
          {pct(Math.abs(burnChange), 1)} vs. yesterday
        </span>
      ),
    },
    {
      label: "Runway",
      icon: ClockIcon,
      value: `${runwayDays} days`,
      sub: "At current burn rate",
    },
    {
      label: "Exchange rate",
      icon: ExchangeIcon,
      value: usd(USD_PER_MILLION_TOKENS, { cents: true }),
      sub: "Blended, per 1M TOK",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="rounded-xl border border-border bg-surface p-4 transition-colors duration-200 hover:border-border-strong"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wide text-subtle">
              {t.label}
            </span>
            <t.icon className="h-4 w-4 text-gold" />
          </div>
          <p className="tnum mt-2 font-mono text-xl font-semibold tracking-tight">
            {t.value}
          </p>
          <p className="mt-0.5 text-xs text-muted">{t.sub}</p>
        </div>
      ))}
    </div>
  );
}

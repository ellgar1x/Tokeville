"use client";

import { useMemo, useState } from "react";
import { useDemo } from "@/store/demo";
import { type ActivityType } from "@/lib/data";
import { tok, usd, usdFromTokens } from "@/lib/format";
import {
  ArrowDownLeftIcon,
  ArrowUpRightIcon,
  ExchangeIcon,
  SendIcon,
} from "./icons";

const META: Record<
  ActivityType,
  { icon: typeof SendIcon; ring: string; tint: string }
> = {
  deposit: { icon: ArrowDownLeftIcon, ring: "border-positive/30", tint: "text-positive" },
  allocation: { icon: SendIcon, ring: "border-gold/30", tint: "text-gold" },
  transfer: { icon: ExchangeIcon, ring: "border-gold/30", tint: "text-gold" },
  spend: { icon: ArrowUpRightIcon, ring: "border-border-strong", tint: "text-muted" },
};

const TABS: { id: "all" | "spend" | "moves"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "spend", label: "Spend" },
  { id: "moves", label: "Transfers" },
];

export function ActivityFeed({ full = false }: { full?: boolean }) {
  const { state } = useDemo();
  const [tab, setTab] = useState<"all" | "spend" | "moves">("all");
  const providerColor = useMemo(() => {
    const m: Record<string, string> = {};
    for (const p of state.providers) m[p.key] = p.color;
    return m;
  }, [state.providers]);

  const items = state.activity.filter((e) => {
    if (tab === "spend") return e.type === "spend";
    if (tab === "moves") return e.type !== "spend";
    return true;
  });

  return (
    <section
      aria-labelledby="activity-heading"
      className="flex flex-col rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
    >
      <div className="flex items-center justify-between gap-4 px-6 py-5">
        <div>
          <h2 id="activity-heading" className="text-sm font-semibold tracking-tight">
            Token ledger
          </h2>
          <p className="mt-0.5 text-xs text-subtle">Every movement of value</p>
        </div>
        <div
          role="tablist"
          aria-label="Filter ledger"
          className="flex rounded-lg border border-border bg-surface-2 p-0.5"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`rounded-[7px] px-2.5 py-1 text-xs font-medium transition-colors duration-200 cursor-pointer ${
                tab === t.id
                  ? "bg-elevated text-foreground shadow-sm"
                  : "text-subtle hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <ul
        className={`scroll-thin flex-1 overflow-y-auto border-t border-border ${full ? "" : "max-h-[420px]"}`}
      >
        {items.length === 0 && (
          <li className="px-6 py-10 text-center text-sm text-subtle">
            No entries in this view.
          </li>
        )}
        {items.map((e) => {
          const meta = META[e.type];
          const Icon = meta.icon;
          const inflow = e.tokens > 0;
          return (
            <li
              key={e.id}
              className="flex items-center gap-3 border-b border-border px-6 py-3.5 last:border-b-0 transition-colors duration-200 hover:bg-surface-2"
            >
              <span
                className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-surface-2 ${meta.ring}`}
              >
                <Icon
                  className={`h-4 w-4 ${meta.tint}`}
                  style={
                    e.provider && providerColor[e.provider]
                      ? { color: providerColor[e.provider] }
                      : undefined
                  }
                />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{e.title}</p>
                <p className="truncate text-xs text-subtle">{e.detail}</p>
              </div>
              <div className="text-right">
                <p
                  className={`tnum font-mono text-sm font-semibold ${
                    e.type === "spend" ? "text-foreground" : "text-gold"
                  }`}
                >
                  {inflow ? "+" : "−"}
                  {tok(Math.abs(e.tokens))}
                </p>
                <p className="tnum text-[11px] text-subtle">
                  {usd(usdFromTokens(Math.abs(e.tokens)))} · {e.time}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

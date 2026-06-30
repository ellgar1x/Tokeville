"use client";

import { useDemo } from "@/store/demo";
import { pct, tok, tokAmount, usd, usdFromTokens } from "@/lib/format";
import { ArrowDownIcon, ArrowUpIcon, PlusIcon, ShieldIcon } from "./icons";

export function SpendByModel() {
  const { state, openModal } = useDemo();
  const { providers } = state;
  const total = providers.reduce((s, p) => s + p.tokens, 0) || 1;

  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const gap = 2.5;

  let offset = 0;
  const segments = providers.map((p) => {
    const length = (p.tokens / total) * circumference;
    const seg = {
      id: p.id,
      color: p.color,
      dash: Math.max(length - gap, 0),
      remainder: circumference - Math.max(length - gap, 0),
      rotation: (offset / circumference) * 360,
    };
    offset += length;
    return seg;
  });

  return (
    <section
      aria-labelledby="spend-heading"
      className="flex flex-col rounded-2xl border border-border bg-surface p-6 shadow-[0_1px_2px_rgba(0,0,0,0.3)] sm:p-7"
    >
      <div className="flex items-center justify-between">
        <h2 id="spend-heading" className="text-sm font-semibold tracking-tight">
          Token spend by model
        </h2>
        <button
          type="button"
          onClick={() => openModal({ type: "addProvider" })}
          className="inline-flex h-7 items-center gap-1 rounded-lg border border-border-strong bg-surface-2 px-2.5 text-xs font-medium text-muted transition-colors duration-200 hover:border-gold/40 hover:text-gold cursor-pointer"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Company AI
        </button>
      </div>

      <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row sm:gap-7">
        <div className="relative h-[150px] w-[150px] shrink-0">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
            <circle
              cx="70"
              cy="70"
              r={radius}
              fill="none"
              stroke="var(--surface-2)"
              strokeWidth="14"
            />
            {segments.map((s) => (
              <circle
                key={s.id}
                cx="70"
                cy="70"
                r={radius}
                fill="none"
                stroke={s.color}
                strokeWidth="14"
                strokeLinecap="round"
                strokeDasharray={`${s.dash} ${s.remainder}`}
                transform={`rotate(${s.rotation} 70 70)`}
              />
            ))}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[11px] font-medium uppercase tracking-wide text-subtle">
              Total
            </span>
            <span className="tnum gold-text font-mono text-xl font-semibold tracking-tight">
              Ŧ{tokAmount(total)}
            </span>
            <span className="tnum text-[11px] text-subtle">
              ≈ {usd(usdFromTokens(total))}
            </span>
          </div>
        </div>

        <ul className="w-full min-w-0 flex-1 space-y-1">
          {providers.map((p) => {
            const share = (p.tokens / total) * 100;
            const up = p.changeMoM >= 0;
            return (
              <li
                key={p.id}
                className="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors duration-200 hover:bg-surface-2"
              >
                <span
                  className="mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: p.color }}
                  aria-hidden
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-medium">{p.name}</span>
                      {p.isCustom && (
                        <span className="inline-flex shrink-0 items-center gap-0.5 rounded-full border border-gold/20 bg-gold-soft px-1.5 py-0.5 text-[9px] font-medium text-gold">
                          <ShieldIcon className="h-2.5 w-2.5" /> Internal
                        </span>
                      )}
                    </span>
                    <span className="tnum shrink-0 font-mono text-sm font-semibold">
                      {tok(p.tokens)}
                    </span>
                  </div>
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="tnum truncate text-xs text-subtle">
                      {pct(share)}
                    </span>
                    <span
                      className={`tnum inline-flex shrink-0 items-center gap-0.5 text-xs ${up ? "text-warning" : "text-positive"}`}
                    >
                      {up ? (
                        <ArrowUpIcon className="h-3 w-3" />
                      ) : (
                        <ArrowDownIcon className="h-3 w-3" />
                      )}
                      {pct(Math.abs(p.changeMoM * 100))}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

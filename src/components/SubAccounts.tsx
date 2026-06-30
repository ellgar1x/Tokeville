"use client";

import { useDemo } from "@/store/demo";
import { type AccountType } from "@/lib/data";
import { pct, tok, usd, usdFromTokens } from "@/lib/format";
import { cycleInfo, projectAccount } from "@/lib/cycle";
import { AlertTriangleIcon, CheckIcon, PlusIcon } from "./icons";

const TYPE_STYLE: Record<AccountType, string> = {
  Team: "bg-gold-soft text-gold border border-gold/20",
  Project: "bg-positive-soft text-positive border border-positive/20",
  Client: "bg-[#6c9bff1f] text-[#6c9bff] border border-[#6c9bff33]",
  Contractor: "bg-warning-soft text-warning border border-warning/20",
};

const AVATAR_BG = [
  "from-[#e8b85f] to-[#c79a45]",
  "from-[#6c9bff] to-[#3f6fd1]",
  "from-[#2bbd95] to-[#1c8a6c]",
  "from-[#e08a63] to-[#c25f3a]",
  "from-[#c084fc] to-[#8b5cf6]",
  "from-[#f5b545] to-[#d18a1e]",
];

export function SubAccounts({
  query = "",
  compact = false,
}: {
  query?: string;
  compact?: boolean;
}) {
  const { state, openModal, setAutoTopup } = useDemo();
  const cycle = cycleInfo();
  const q = query.trim().toLowerCase();
  const accounts = q
    ? state.accounts.filter(
        (a) =>
          a.name.toLowerCase().includes(q) ||
          a.owner.toLowerCase().includes(q) ||
          a.type.toLowerCase().includes(q),
      )
    : state.accounts;

  return (
    <section
      aria-labelledby="accounts-heading"
      className="rounded-2xl border border-border bg-surface shadow-[0_1px_2px_rgba(0,0,0,0.3)]"
    >
      <div className="flex items-center justify-between gap-4 px-6 py-5 sm:px-7">
        <div>
          <h2 id="accounts-heading" className="text-sm font-semibold tracking-tight">
            Sub-accounts
          </h2>
          <p className="mt-0.5 text-xs text-subtle">
            Token budgets allocated across teams, projects, clients, and
            contractors
          </p>
        </div>
        <button
          type="button"
          onClick={() => openModal({ type: "newAccount" })}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-border-strong bg-surface-2 px-3.5 text-sm font-medium text-foreground transition-colors duration-200 hover:border-gold/40 hover:text-gold cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
        >
          <PlusIcon className="h-4 w-4" />
          <span className="hidden sm:inline">New account</span>
        </button>
      </div>

      <div className="overflow-x-auto">
        <table
          className={`w-full border-t border-border text-sm ${compact ? "min-w-[560px]" : "min-w-[920px]"}`}
        >
          <thead>
            <tr className="text-left text-xs font-medium uppercase tracking-wide text-subtle">
              <th scope="col" className="px-6 py-3 font-medium sm:px-7">
                Account
              </th>
              <th scope="col" className="px-6 py-3 font-medium">
                Token budget
              </th>
              <th scope="col" className="w-[30%] px-6 py-3 font-medium">
                Budget used
              </th>
              <th scope="col" className="px-6 py-3 text-right font-medium">
                Remaining
              </th>
              {!compact && (
                <th scope="col" className="px-6 py-3 font-medium">
                  Burn projection
                </th>
              )}
              <th scope="col" className="px-6 py-3 text-right font-medium sm:px-7">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {accounts.length === 0 && (
              <tr className="border-t border-border">
                <td
                  colSpan={compact ? 5 : 6}
                  className="px-6 py-10 text-center text-sm text-subtle"
                >
                  No accounts match “{query}”.
                </td>
              </tr>
            )}
            {accounts.map((a, i) => {
              const used = (a.tokensUsed / a.tokenBudget) * 100;
              const near = used >= 85;
              const remaining = a.tokenBudget - a.tokensUsed;
              const barColor = near ? "var(--warning)" : "var(--gold)";
              const proj = projectAccount(a.tokensUsed, remaining, cycle);
              return (
                <tr
                  key={a.id}
                  className="group border-t border-border transition-colors duration-200 hover:bg-surface-2"
                >
                  <td className="px-6 py-4 sm:px-7">
                    <div className="flex items-center gap-3">
                      <span
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-[11px] font-semibold text-[#0a0a0b] ${AVATAR_BG[i % AVATAR_BG.length]}`}
                        aria-hidden
                      >
                        {a.initials}
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{a.name}</span>
                          <span
                            className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${TYPE_STYLE[a.type]}`}
                          >
                            {a.type}
                          </span>
                        </div>
                        <p className="truncate text-xs text-subtle">{a.owner}</p>
                      </div>
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="tnum whitespace-nowrap font-mono font-medium">
                      {tok(a.tokenBudget)}
                    </div>
                    <div className="tnum whitespace-nowrap text-xs text-subtle">
                      ≈ {usd(usdFromTokens(a.tokenBudget))}
                    </div>
                  </td>

                  <td className="px-6 py-4">
                    <div className="flex items-center justify-between text-xs">
                      <span className="tnum font-mono text-muted">
                        {tok(a.tokensUsed)} used
                      </span>
                      <span
                        className={`tnum font-medium ${near ? "text-warning" : "text-muted"}`}
                      >
                        {pct(used)}
                      </span>
                    </div>
                    <div
                      className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2"
                      role="progressbar"
                      aria-valuenow={Math.round(used)}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${a.name} budget used`}
                    >
                      <div
                        className="h-full rounded-full transition-[width] duration-500"
                        style={{
                          width: `${Math.min(used, 100)}%`,
                          backgroundColor: barColor,
                        }}
                      />
                    </div>
                  </td>

                  <td className="px-6 py-4 text-right">
                    <span className="tnum font-mono font-semibold">{tok(remaining)}</span>
                    {a.autoTopup && (
                      <p className="text-[11px] font-medium text-gold">Auto top-up on</p>
                    )}
                  </td>

                  {!compact && (
                    <td className="px-6 py-4">
                      {proj.noUsage ? (
                        <span className="text-xs text-subtle">No usage yet</span>
                      ) : proj.willRunOut ? (
                        <div className="text-xs">
                          <span className="inline-flex items-center gap-1 whitespace-nowrap font-medium text-warning">
                            <AlertTriangleIcon className="h-3.5 w-3.5" />
                            Empties in ~{Math.max(Math.ceil(proj.daysToEmpty), 1)}d
                          </span>
                          <p className="whitespace-nowrap text-subtle">
                            before cycle ends ({cycle.daysRemaining}d left)
                          </p>
                        </div>
                      ) : (
                        <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-positive">
                          <CheckIcon className="h-3.5 w-3.5" />
                          Lasts the cycle
                        </span>
                      )}
                    </td>
                  )}

                  <td className="px-6 py-4 text-right sm:px-7">
                    <div className="flex items-center justify-end gap-2">
                      {!compact && (
                        <button
                          type="button"
                          title={`Auto top-up ${tok(Math.round(a.tokenBudget * 0.25))} from treasury when below 20%`}
                          onClick={() =>
                            setAutoTopup(
                              a.id,
                              !a.autoTopup,
                              a.autoTopup ? a.autoTopupAmount : Math.round(a.tokenBudget * 0.25),
                            )
                          }
                          className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium transition-colors duration-200 cursor-pointer ${
                            a.autoTopup
                              ? "border-gold/40 bg-gold-soft text-gold"
                              : "border-border-strong bg-surface text-subtle hover:text-foreground"
                          }`}
                        >
                          <span
                            className={`h-1.5 w-1.5 rounded-full ${a.autoTopup ? "bg-gold" : "bg-subtle"}`}
                          />
                          Auto
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openModal({ type: "allocate", accountId: a.id })}
                        className="inline-flex h-8 items-center rounded-lg border border-border-strong bg-surface px-3 text-xs font-medium text-muted opacity-0 transition-all duration-200 hover:border-gold/40 hover:text-gold focus:opacity-100 group-hover:opacity-100 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-gold/40"
                      >
                        Top up
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

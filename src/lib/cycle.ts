/**
 * Billing cycle = the current calendar month. Burn projection estimates whether
 * a sub-account will exhaust its budget before the cycle ends, using the average
 * usage velocity so far this cycle (tokens spent ÷ days elapsed).
 */

export interface CycleInfo {
  label: string;
  daysInCycle: number;
  daysElapsed: number;
  daysRemaining: number;
}

export function cycleInfo(now: Date = new Date()): CycleInfo {
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInCycle = new Date(year, month + 1, 0).getDate();
  const daysElapsed = now.getDate();
  return {
    label: now.toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    daysInCycle,
    daysElapsed,
    daysRemaining: Math.max(daysInCycle - daysElapsed, 0),
  };
}

export interface Projection {
  /** tokens/day at the cycle's average pace */
  velocity: number;
  /** days until the budget hits zero at current velocity (Infinity if idle) */
  daysToEmpty: number;
  /** true if it empties before the cycle ends */
  willRunOut: boolean;
  noUsage: boolean;
}

export function projectAccount(
  tokensUsed: number,
  remaining: number,
  cycle: CycleInfo,
): Projection {
  const velocity = tokensUsed / Math.max(cycle.daysElapsed, 1);
  const noUsage = tokensUsed <= 0 || velocity <= 0;
  const daysToEmpty = noUsage ? Infinity : remaining / velocity;
  return {
    velocity,
    daysToEmpty,
    willRunOut: !noUsage && daysToEmpty < cycle.daysRemaining,
    noUsage,
  };
}

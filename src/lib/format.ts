/**
 * Formatting helpers — Tokeville treats TOKENS as the primary currency.
 *
 * Tokens (ticker "TOK", symbol "Ŧ") are the unit of value you hold, allocate,
 * and transfer. US dollars are only shown as a secondary reference, converted
 * at the treasury's blended exchange rate.
 */

/** Treasury exchange rate: blended cost across providers. $10 per 1M tokens. */
export const USD_PER_MILLION_TOKENS = 10;

/** The Tokeville token glyph — its own currency symbol, like $ or €. */
export const TOKEN_SYMBOL = "Ŧ";
export const TOKEN_TICKER = "TOK";

/** Fund the treasury in any of the world's five largest currencies. */
export interface Currency {
  code: string;
  symbol: string;
  name: string;
  /** USD value of one unit. */
  usdPerUnit: number;
}

export const CURRENCIES: Currency[] = [
  { code: "USD", symbol: "$", name: "US Dollar", usdPerUnit: 1 },
  { code: "EUR", symbol: "€", name: "Euro", usdPerUnit: 1.08 },
  { code: "CNY", symbol: "CN¥", name: "Chinese Yuan", usdPerUnit: 0.14 },
  { code: "JPY", symbol: "¥", name: "Japanese Yen", usdPerUnit: 0.0067 },
  { code: "GBP", symbol: "£", name: "British Pound", usdPerUnit: 1.27 },
];

/** Tokens received for an amount in a given currency, via its USD value. */
export function tokensFromCurrency(amount: number, c: Currency): number {
  return tokensFromUsd(amount * c.usdPerUnit);
}

function trim(n: string): string {
  return n.replace(/\.0+$|(\.\d*?)0+$/, "$1");
}

/** Compact token magnitude without symbol: 4_258_000_000 -> "4.26B". */
export function tokAmount(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}${trim((abs / 1_000_000_000).toFixed(2))}B`;
  if (abs >= 1_000_000) return `${sign}${trim((abs / 1_000_000).toFixed(1))}M`;
  if (abs >= 1_000) return `${sign}${trim((abs / 1_000).toFixed(1))}K`;
  return `${sign}${abs.toLocaleString("en-US")}`;
}

/** Compact tokens with the Ŧ symbol: "Ŧ4.26B". */
export function tok(value: number): string {
  return `${TOKEN_SYMBOL}${tokAmount(value)}`;
}

/** Full token count with grouping: "4,258,000,000". */
export function tokFull(value: number): string {
  return value.toLocaleString("en-US");
}

export function usdFromTokens(tokens: number): number {
  return (tokens / 1_000_000) * USD_PER_MILLION_TOKENS;
}

export function tokensFromUsd(dollars: number): number {
  return (dollars / USD_PER_MILLION_TOKENS) * 1_000_000;
}

export function usd(value: number, opts?: { cents?: boolean }): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: opts?.cents ? 2 : 0,
    maximumFractionDigits: opts?.cents ? 2 : 0,
  });
}

export function pct(value: number, digits = 0): string {
  return `${value.toFixed(digits)}%`;
}

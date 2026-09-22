// Salary normalisation shared by the job briefing snapshot and the fit analysis.
// Two axes: pay period and currency. Both must be reconciled before any
// candidate expectation can be compared with a job's posted band.
import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

// Every period expressed as payments per month, so any pair can be converted.
const PERIODS_PER_MONTH: Record<string, number> = {
  annual: 1 / 12,
  annually: 1 / 12,
  yearly: 1 / 12,
  year: 1 / 12,
  per_year: 1 / 12,
  monthly: 1,
  month: 1,
  per_month: 1,
  semimonthly: 2,
  biweekly: 26 / 12,
  weekly: 52 / 12,
  week: 52 / 12,
  daily: 260 / 12,
  day: 260 / 12,
  hourly: 2080 / 12,
  hour: 2080 / 12,
};

export function normalisePeriod(period: string | null | undefined): string {
  return String(period ?? "").trim().toLowerCase().replace(/[\s-]+/g, "_");
}

export function normaliseCurrency(currency: string | null | undefined): string {
  return String(currency ?? "").trim().toUpperCase();
}

export function toPeriod(amount: number, from: string, to: string): number | null {
  if (!Number.isFinite(amount)) return null;
  const f = PERIODS_PER_MONTH[normalisePeriod(from)];
  const t = PERIODS_PER_MONTH[normalisePeriod(to)];
  if (!f || !t) return normalisePeriod(from) === normalisePeriod(to) ? amount : null;
  const monthly = amount * f;
  return monthly / t;
}

export type RateMap = Map<string, number>;

// Latest rate per currency pair for the tenant (falls back to global rows).
export async function loadCurrencyRates(
  client: SupabaseClient,
  tenantId: string | null,
): Promise<RateMap> {
  const map: RateMap = new Map();
  const seen = new Set<string>();
  const { data } = await client
    .from("currency_rates")
    .select("tenant_id, base_currency, quote_currency, rate, rate_date")
    .or(tenantId ? `tenant_id.eq.${tenantId},tenant_id.is.null` : "tenant_id.is.null")
    .order("rate_date", { ascending: false })
    .limit(2000);
  for (const row of data ?? []) {
    const base = normaliseCurrency((row as any).base_currency);
    const quote = normaliseCurrency((row as any).quote_currency);
    const rate = Number((row as any).rate);
    if (!base || !quote || !Number.isFinite(rate) || rate <= 0) continue;
    const key = `${base}:${quote}`;
    if (seen.has(key)) continue;
    seen.add(key);
    map.set(key, rate);
    if (!map.has(`${quote}:${base}`)) map.set(`${quote}:${base}`, 1 / rate);
  }
  return map;
}

export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: RateMap,
): number | null {
  if (from === to) return amount;
  const direct = rates.get(`${from}:${to}`);
  if (direct) return amount * direct;
  // Cross through any shared pivot currency we have both legs for.
  for (const key of rates.keys()) {
    const [base, quote] = key.split(":");
    if (base !== from) continue;
    const second = rates.get(`${quote}:${to}`);
    if (second) return amount * rates.get(key)! * second;
  }
  return null;
}

export type NormalisedSalary = {
  /** Amount expressed in the target currency and period. */
  amount: number;
  currency: string;
  period: string;
  /** True when either the currency or the period had to be changed. */
  converted: boolean;
  /** The figure exactly as captured, for provenance in prose. */
  original: { amount: number; currency: string; period: string };
};

/**
 * Express a captured expectation in the job's currency and period.
 * Returns null when the pair cannot be reconciled — callers must then treat
 * the comparison as unavailable rather than comparing incompatible figures.
 */
export function normaliseSalary(
  amount: number | null | undefined,
  fromCurrency: string | null | undefined,
  fromPeriod: string | null | undefined,
  toCurrency: string | null | undefined,
  toPeriodName: string | null | undefined,
  rates: RateMap,
): NormalisedSalary | null {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) return null;
  const targetCurrency = normaliseCurrency(toCurrency) || "USD";
  const targetPeriod = normalisePeriod(toPeriodName) || "annually";
  const sourceCurrency = normaliseCurrency(fromCurrency) || targetCurrency;
  const sourcePeriod = normalisePeriod(fromPeriod) || targetPeriod;

  const periodised = toPeriod(value, sourcePeriod, targetPeriod);
  if (periodised == null) return null;
  const converted = convertCurrency(periodised, sourceCurrency, targetCurrency, rates);
  if (converted == null) return null;

  return {
    amount: Math.round(converted),
    currency: targetCurrency,
    period: targetPeriod,
    converted: sourceCurrency !== targetCurrency || sourcePeriod !== targetPeriod,
    original: { amount: value, currency: sourceCurrency, period: sourcePeriod },
  };
}

export function formatMoney(amount: number, currency: string): string {
  return `${currency} ${Math.round(amount).toLocaleString("en-US")}`;
}

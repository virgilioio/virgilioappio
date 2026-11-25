/**
 * The salary on an offer (Allan, 2026-11-25). An offer's Salary field holds
 * the amount, its currency and how it's paid, per month or per year, chosen on
 * each offer (the form's setting is only where it starts). One Salary field
 * per form is the base salary: it becomes the hired salary when the candidate
 * is marked hired, and Gio Sales bills the success fee on it per year.
 *
 * The rules here mirror the database (`offer_form_base_field`,
 * `offer_letter_base_salary`, `hire_offer_for` in
 * 20261125053051_hired_salary); keep them in step.
 */

export type SalaryPeriod = 'monthly' | 'annually' | 'hourly'

export interface OfferSalary {
  amount: string
  currency: string
  period: SalaryPeriod
}

export const SALARY_PERIODS: { key: SalaryPeriod; label: string; short: string }[] = [
  { key: 'monthly', label: 'Per month', short: 'per month' },
  { key: 'annually', label: 'Per year', short: 'per year' },
  { key: 'hourly', label: 'Per hour', short: 'per hour' },
]

export function salaryPeriod(v: unknown): SalaryPeriod | null {
  const s = typeof v === 'string' ? v.trim().toLowerCase() : ''
  if (s === 'monthly' || s === 'month') return 'monthly'
  if (s === 'annually' || s === 'annual' || s === 'yearly' || s === 'year') return 'annually'
  if (s === 'hourly' || s === 'hour') return 'hourly'
  return null
}

export function periodWords(period: SalaryPeriod | null | undefined): string {
  return SALARY_PERIODS.find((p) => p.key === period)?.short ?? ''
}

type Config = { currency?: unknown; period?: unknown; base?: unknown } | null | undefined

/** A stored Salary value (JSON text, an object or a bare number) as its three parts. */
export function readOfferSalary(value: unknown, config?: Config): OfferSalary {
  const start: OfferSalary = {
    amount: '',
    currency: typeof config?.currency === 'string' && config.currency ? config.currency : 'USD',
    period: salaryPeriod(config?.period) ?? 'annually',
  }
  let v: unknown = value
  if (typeof v === 'string' && v.trim()) {
    const text = v
    try {
      v = JSON.parse(text)
    } catch {
      return { ...start, amount: text.replace(/[^0-9.]/g, '') }
    }
  }
  if (typeof v === 'number') return { ...start, amount: String(v) }
  if (!v || typeof v !== 'object') return start
  const o = v as Record<string, unknown>
  return {
    amount: o.amount == null ? '' : String(o.amount),
    currency: typeof o.currency === 'string' && o.currency ? o.currency : start.currency,
    period: salaryPeriod(o.period) ?? start.period,
  }
}

/** What the composer saves: JSON text, as offers always have. */
export function writeOfferSalary(s: OfferSalary): string {
  return JSON.stringify({ amount: s.amount, currency: s.currency, period: s.period })
}

interface FieldLike {
  field_name: string
  field_type: string
  field_config?: unknown
  display_order: number
}

/** The form's base salary field: the one flagged, else `base_salary`, else the first Salary field. */
export function baseSalaryField<T extends FieldLike>(fields: T[]): T | null {
  const salary = fields.filter((f) => f.field_type === 'salary')
  if (!salary.length) return null
  const rank = (f: T) =>
    (f.field_config as Config)?.base === true ? 0 : f.field_name === 'base_salary' ? 1 : 2
  return [...salary].sort((a, b) => rank(a) - rank(b) || a.display_order - b.display_order)[0]
}

export interface BaseSalary {
  amount: number
  currency: string
  period: SalaryPeriod
}

/** The offer's base salary, or null when the form has none or it's empty. */
export function offerBaseSalary(fields: FieldLike[], values: Record<string, unknown> | null | undefined): BaseSalary | null {
  if (!values) return null
  const field = baseSalaryField(fields)
  const raw = field ? values[field.field_name] : (values.base_salary ?? values.salary ?? values.base_pay)
  if (raw == null || raw === '') return null
  const s = readOfferSalary(raw, field?.field_config as Config)
  const amount = Number(s.amount)
  if (!Number.isFinite(amount) || amount <= 0) return null
  return { amount, currency: s.currency, period: s.period }
}

/** A salary as one year's pay: what Gio Sales bills the success fee on. */
export function salaryPerYear(amount: number, period: SalaryPeriod): number {
  return period === 'monthly' ? amount * 12 : period === 'hourly' ? amount * 2080 : amount
}

export function salaryPerMonth(amount: number, period: SalaryPeriod): number {
  return period === 'annually' ? amount / 12 : period === 'hourly' ? (amount * 2080) / 12 : amount
}

/** "MXN 40,000 per month". */
export function salaryWords(s: { amount: number; currency: string; period?: SalaryPeriod | null }): string {
  const n = s.amount.toLocaleString('en-US', { maximumFractionDigits: Number.isInteger(s.amount) ? 0 : 2 })
  return [s.currency, n, periodWords(s.period)].filter(Boolean).join(' ')
}

/** Offers that can't carry a hire. */
const DEAD = new Set(['declined', 'withdrawn', 'expired', 'rejected', 'cancelled'])
export const offerIsLive = (status: string | null | undefined) => !DEAD.has(status ?? '')

/**
 * One way to turn a stored offer value into words (2026-10-17). Offer forms
 * save some values as JSON text (salary: {"amount","currency"}, location:
 * {"city","state","country"}); every place that shows an offer value goes
 * through here so none of them prints the raw JSON. The database has the same
 * rules in sign_offer_display() for agreements.
 */

export const EMPLOYMENT_TYPE_LABELS: Record<string, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  temporary: 'Temporary',
  internship: 'Internship',
  freelance: 'Freelance',
}

export const WORK_LOCATION_LABELS: Record<string, string> = {
  remote: 'Remote',
  hybrid: 'Hybrid',
  onsite: 'On-site',
  on_site: 'On-site',
}

const PERIOD_WORDS: Record<string, string> = {
  hourly: 'hour',
  daily: 'day',
  weekly: 'week',
  monthly: 'month',
  annually: 'year',
  yearly: 'year',
  annual: 'year',
}

/** Parses JSON stored as text; anything else comes back unchanged. */
export function parseStored(value: unknown): unknown {
  if (typeof value !== 'string') return value
  const t = value.trim()
  if (!(t.startsWith('{') || t.startsWith('['))) return value
  try {
    return JSON.parse(t)
  } catch {
    return value
  }
}

const isBlank = (v: unknown) => v === null || v === undefined || (typeof v === 'string' && v.trim() === '')

/** "MXN 100,000" — whole numbers without decimals, otherwise two. */
export function formatMoney(amount: unknown, currency?: string | null): string | null {
  if (isBlank(amount)) return null
  const n = Number(String(amount).replace(/,/g, ''))
  if (!Number.isFinite(n)) return String(amount)
  const num = n.toLocaleString('en-US', Number.isInteger(n) ? { maximumFractionDigits: 0 } : { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return [currency?.trim() || null, num].filter(Boolean).join(' ')
}

/** A YYYY-MM-DD value as "October 26, 2026"; other text unchanged. */
export function formatOfferDate(value: unknown): string | null {
  if (isBlank(value)) return null
  const s = String(value).trim()
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s)
  if (!m) return s
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

export interface OfferValueContext {
  /** The field's config (salary: { currency, period }). */
  config?: Record<string, unknown> | null
  /** Recruiter user id → name. */
  recruiterName?: (id: string) => string | null | undefined
  /** Select / checkbox-group option value → label. */
  optionLabel?: (value: string) => string | null | undefined
  /** Add "per month" etc. to salaries when the field has a period. */
  withPeriod?: boolean
}

/**
 * The words for one offer value, or null when it's empty. Never returns JSON.
 */
export function formatOfferValue(raw: unknown, type?: string | null, ctx: OfferValueContext = {}): string | null {
  const value = parseStored(raw)
  if (isBlank(value)) return null

  switch (type) {
    case 'salary': {
      const obj = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : { amount: value }
      const currency = (obj.currency as string) || (ctx.config?.currency as string) || null
      const money = formatMoney(obj.amount, currency)
      if (!money) return null
      const period = PERIOD_WORDS[String(obj.period || ctx.config?.period || '').toLowerCase()]
      return ctx.withPeriod && period ? `${money} per ${period}` : money
    }
    case 'location': {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        const o = value as Record<string, unknown>
        const s = [o.city, o.state, o.country].filter((x) => !isBlank(x)).join(', ')
        return s || null
      }
      return String(value)
    }
    case 'date':
      return formatOfferDate(value)
    case 'checkbox':
      return value === true || value === 'true' ? 'Yes' : 'No'
    case 'employment_type':
      return EMPLOYMENT_TYPE_LABELS[String(value)] ?? String(value)
    case 'work_location':
      return WORK_LOCATION_LABELS[String(value)] ?? String(value)
    case 'recruiter':
      return ctx.recruiterName?.(String(value)) || String(value)
    case 'select':
      return ctx.optionLabel?.(String(value)) || String(value)
    case 'checkbox_group': {
      const list = Array.isArray(value) ? value : [value]
      return list.map((v) => ctx.optionLabel?.(String(v)) || String(v)).join(', ') || null
    }
  }

  // Unknown type: still never show JSON.
  if (Array.isArray(value)) return value.map(String).join(', ') || null
  if (value && typeof value === 'object') {
    const o = value as Record<string, unknown>
    if ('amount' in o) return formatMoney(o.amount, o.currency as string)
    if ('city' in o || 'country' in o) return [o.city, o.state, o.country].filter((x) => !isBlank(x)).join(', ') || null
    return Object.values(o).filter((x) => !isBlank(x) && typeof x !== 'object').map(String).join(', ') || null
  }
  if (typeof value === 'boolean') return value ? 'Yes' : 'No'
  return String(value)
}

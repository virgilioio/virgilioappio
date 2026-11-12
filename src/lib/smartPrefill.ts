/**
 * Smart questions on a scorecard start from what the candidate already told us
 * (2026-11-12): a salary, phone, LinkedIn or location question with no saved answer
 * is filled from the candidate's profile (which the careers application fills),
 * the salary converted to the question's own currency and period. The interviewer
 * changes it if it's different now; saving copies the answer back to the profile as
 * before (`syncSmartFieldsToProfile` in ScorecardSheet).
 */

export type SmartType = 'salary_expectations' | 'phone' | 'linkedin' | 'location'

export interface CandidateSmartFields {
  salary_amount?: number | string | null
  salary_currency?: string | null
  salary_period?: string | null
  phone?: string | null
  linkedin_url?: string | null
  location_city?: string | null
  location_state?: string | null
  location_country?: string | null
}

export interface SmartQuestion {
  id: string
  answer_type: string
  salary_config?: { currency?: string; period?: string } | null
}

export type Converter = (amount: number, fromCurrency: string, toCurrency: string) => number | null

// Payments per month, as the server's salary rules count them (_shared/salary.ts).
const PER_MONTH: Record<string, number> = {
  annual: 1 / 12, annually: 1 / 12, yearly: 1 / 12, year: 1 / 12,
  monthly: 1, month: 1,
  weekly: 52 / 12, week: 52 / 12,
  hourly: 2080 / 12, hour: 2080 / 12,
}

/** A salary in another period: 10,000 a month is 120,000 a year. */
export function toPeriod(amount: number, from: string, to: string): number | null {
  const f = PER_MONTH[String(from || '').toLowerCase()]
  const t = PER_MONTH[String(to || '').toLowerCase()]
  if (!f || !t) return String(from).toLowerCase() === String(to).toLowerCase() ? amount : null
  return (amount * f) / t
}

/** The candidate's salary in the question's currency and period, rounded; null when it can't be converted. */
export function salaryFor(c: CandidateSmartFields, q: SmartQuestion, convert: Converter): number | null {
  const amount = Number(c.salary_amount)
  if (!Number.isFinite(amount) || amount <= 0) return null
  const toCurrency = String(q.salary_config?.currency || 'USD').toUpperCase()
  const toPeriodName = String(q.salary_config?.period || 'annually')
  const fromCurrency = String(c.salary_currency || toCurrency).toUpperCase()
  const fromPeriod = String(c.salary_period || toPeriodName)
  const periodised = toPeriod(amount, fromPeriod, toPeriodName)
  if (periodised == null) return null
  const converted = fromCurrency === toCurrency ? periodised : convert(periodised, fromCurrency, toCurrency)
  if (converted == null || !Number.isFinite(converted) || converted <= 0) return null
  return Math.round(converted)
}

/**
 * What to put in each smart question that has no answer yet. Questions already
 * answered (by the interviewer, a restored draft or Gio) are left alone.
 */
export function smartPrefill(
  questions: SmartQuestion[],
  answered: (questionId: string) => boolean,
  c: CandidateSmartFields | null | undefined,
  convert: Converter,
): Record<string, string> {
  const out: Record<string, string> = {}
  if (!c) return out
  for (const q of questions) {
    if (answered(q.id)) continue
    let value: string | null = null
    switch (q.answer_type) {
      case 'salary_expectations': {
        const n = salaryFor(c, q, convert)
        value = n != null ? String(n) : null
        break
      }
      case 'phone':
        value = c.phone?.trim() || null
        break
      case 'linkedin':
        value = c.linkedin_url?.trim() || null
        break
      case 'location': {
        const line = [c.location_city, c.location_state, c.location_country].map((s) => (s ?? '').trim()).filter(Boolean).join(', ')
        value = line || null
        break
      }
    }
    if (value) out[q.id] = value
  }
  return out
}

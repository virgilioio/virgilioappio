/**
 * Value formats for data fields (2026-10-17). The database prints them
 * (sign_format, migration 20261017214923); this mirrors it for the editor's
 * samples, so what the panel shows is what the agreement prints. A value in a
 * format travels as values["key|format"]; no format keeps the default wording.
 */
import type { OfferFormTag } from './templates'

export type ValueFormat = 'money_code' | 'money_symbol' | 'money_words' | 'date_long' | 'date_numeric' | 'date_dmy' | 'number' | 'number_words'
export type FormatKind = 'money' | 'date' | 'number'

/** The field list's groups, inferred from the form field's type and name. */
export type OfferCategory = 'Candidate' | 'Job' | 'Compensation' | 'Dates' | 'Terms'
export const OFFER_CATEGORIES: OfferCategory[] = ['Candidate', 'Job', 'Compensation', 'Dates', 'Terms']

export function offerCategory(t: Pick<OfferFormTag, 'key' | 'label' | 'type'>): OfferCategory {
  const s = `${t.key} ${t.label}`.toLowerCase()
  if (t.type === 'salary' || /salar|compens|bonus|equity|commission|\bpay\b|wage|\bote\b|earning|stipend|allowance|(^|[^a-z])rate([^a-z]|$)/.test(s)) return 'Compensation'
  if (t.type === 'date' || /(^|[^a-z])date|(^|[^a-z])day([^a-z]|$)/.test(s)) return 'Dates'
  if (['recruiter', 'employment_type', 'work_location'].includes(t.type)) return 'Job'
  if (['email', 'phone', 'linkedin', 'location'].includes(t.type) || /candidate|full.?name|legal.?name|\bname\b|address|personal/.test(s)) return 'Candidate'
  if (/job|title|role|department|team|manager|report|description|position|schedule|hours|location|office|remote/.test(s)) return 'Job'
  return 'Terms'
}

/** Which formats a value takes: by the form field's type, or the standard keys'. */
export function formatKind(key: string, formType: string | null | undefined): FormatKind | null {
  if (formType === 'salary' || key === 'salary') return 'money'
  if (formType === 'date' || key === 'today' || key === 'start') return 'date'
  if (formType === 'number') return 'number'
  return null
}

export interface FormatOption {
  /** null keeps the default wording. */
  value: ValueFormat | null
  label: string
}

export const FORMAT_OPTIONS: Record<FormatKind, FormatOption[]> = {
  money: [
    { value: null, label: 'As on the offer' },
    { value: 'money_code', label: 'With the period' },
    { value: 'money_symbol', label: 'With the symbol' },
    { value: 'money_words', label: 'In words, with the figure' },
  ],
  // The default prints like date_long, so it stands in for it.
  date: [
    { value: null, label: 'Month first' },
    { value: 'date_numeric', label: 'Numbers' },
    { value: 'date_dmy', label: 'Day first' },
  ],
  number: [
    { value: null, label: 'A figure' },
    { value: 'number_words', label: 'In words, with the figure' },
  ],
}

const ONES = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen']
const TENS = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety']
const SCALES = ['', ' thousand', ' million', ' billion', ' trillion']

/** English words for a whole number (sign_num_words). */
export function numWords(n: number): string {
  n = Math.trunc(n)
  if (n < 0) return `minus ${numWords(-n)}`
  if (n === 0) return 'zero'
  const parts: string[] = []
  for (let i = 0; n > 0 && i < SCALES.length; i++, n = Math.floor(n / 1000)) {
    const c = n % 1000
    if (!c) continue
    const h = Math.floor(c / 100)
    const r = c % 100
    const w = [h ? `${ONES[h]} hundred` : '', r < 20 ? (r ? ONES[r] : '') : TENS[Math.floor(r / 10)] + (r % 10 ? `-${ONES[r % 10]}` : '')].filter(Boolean).join(' ')
    parts.unshift(w + SCALES[i])
  }
  return parts.join(' ')
}

const SYMBOL: Record<string, string> = { USD: '$', MXN: '$', CAD: '$', COP: '$', ARS: '$', CLP: '$', EUR: '€', GBP: '£', BRL: 'R$', PEN: 'S/' }
const CURRENCY_WORDS: Record<string, string> = {
  USD: 'US dollars', MXN: 'Mexican pesos', CAD: 'Canadian dollars', EUR: 'euros', GBP: 'British pounds', COP: 'Colombian pesos',
  ARS: 'Argentine pesos', CLP: 'Chilean pesos', BRL: 'Brazilian reais', PEN: 'Peruvian soles',
}
const PER: Record<string, [string, string]> = {
  annually: ['yearly', 'per year'], yearly: ['yearly', 'per year'], monthly: ['monthly', 'per month'], weekly: ['weekly', 'per week'],
  biweekly: ['biweekly', 'every two weeks'], daily: ['daily', 'per day'], hourly: ['hourly', 'per hour'],
}
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const fig = (n: number) => n.toLocaleString('en-US', { maximumFractionDigits: 2 })
const pad = (n: number) => String(n).padStart(2, '0')

/** A sample of each format, from the form field's settings (currency and period). */
export function formatSample(kind: FormatKind, format: ValueFormat | null, config?: Record<string, unknown> | null): string {
  if (kind === 'money') {
    const cur = String(config?.currency ?? 'MXN').toUpperCase()
    const [per, every] = PER[String(config?.period ?? 'annually').toLowerCase()] ?? ['', '']
    const amount = 480000
    if (format === 'money_code') return `${cur} ${fig(amount)}${per ? ` / ${per}` : ''}`
    if (format === 'money_symbol') return `${SYMBOL[cur] ?? ''}${fig(amount)} ${cur}${every ? ` ${every}` : ''}`
    if (format === 'money_words') return `${numWords(amount)} ${CURRENCY_WORDS[cur] ?? cur} (${cur} ${fig(amount)})${every ? ` ${every}` : ''}`
    return `${cur} ${fig(amount)}`
  }
  if (kind === 'date') {
    const d = { y: 2026, m: 10, day: 26 }
    if (format === 'date_numeric') return `${pad(d.day)}/${pad(d.m)}/${d.y}`
    if (format === 'date_dmy') return `${d.day} ${MONTHS[d.m - 1]} ${d.y}`
    return `${MONTHS[d.m - 1]} ${d.day}, ${d.y}`
  }
  return format === 'number_words' ? `twelve (12)` : '12'
}

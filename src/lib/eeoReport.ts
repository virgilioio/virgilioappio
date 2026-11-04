import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import {
  EEO_DISABILITY_OPTIONS,
  EEO_GENDER_OPTIONS,
  EEO_RACE_OPTIONS,
  EEO_VETERAN_OPTIONS,
} from '@/lib/eeo'

/**
 * The self-identification report (2026-11-04): totals only, never a named person.
 * `eeo_report` (database) counts answers per question for applications made through a
 * careers form and how far each group got; counts of 1 to 4 come back as null
 * ("fewer than 5"). Admins only (`can_view_eeo`, GEE01 for anyone else).
 */

export type EeoQuestion = 'gender' | 'race_ethnicity' | 'veteran_status' | 'disability_status'
export type EeoPeriod = 'year' | 'quarter' | '12m' | 'all'

export type EeoCell = number | null
export interface EeoAnswerRow {
  answer: string
  applicants: EeoCell
  past_review: EeoCell
  offer: EeoCell
  hired: EeoCell
}
export interface EeoReport {
  applicants: number
  answered_any: number
  declined_all: number
  not_answered: number
  min_group: number
  questions: Partial<Record<EeoQuestion, EeoAnswerRow[]>>
}

export const NOT_ANSWERED = 'not_answered'

export const EEO_QUESTIONS: { id: EeoQuestion; title: string; options: { value: string; label: string }[] }[] = [
  { id: 'gender', title: 'Gender', options: EEO_GENDER_OPTIONS },
  { id: 'race_ethnicity', title: 'Race and ethnicity', options: EEO_RACE_OPTIONS },
  { id: 'veteran_status', title: 'Veteran status', options: EEO_VETERAN_OPTIONS },
  { id: 'disability_status', title: 'Disability', options: EEO_DISABILITY_OPTIONS },
]

export const PERIOD_LABEL: Record<EeoPeriod, string> = {
  year: 'This year',
  quarter: 'This quarter',
  '12m': 'Last 12 months',
  all: 'All time',
}

const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

/** The period as "YYYY-MM-DD" bounds (the database reads them as Mexico City days); null for all time. */
export function eeoPeriodRange(period: EeoPeriod, today: Date): { from: string; to: string } | null {
  const y = today.getFullYear()
  const m = today.getMonth()
  if (period === 'all') return null
  if (period === 'year') return { from: `${y}-01-01`, to: `${y}-12-31` }
  if (period === 'quarter') {
    const start = m - (m % 3)
    return { from: ymd(new Date(y, start, 1)), to: ymd(new Date(y, start + 3, 0)) }
  }
  const from = new Date(y - 1, m, today.getDate() + 1)
  return { from: ymd(from), to: ymd(today) }
}

/**
 * Every option of a question, in the form's order, with "Didn't answer" last; options
 * nobody chose read 0 (the database only returns answers someone gave).
 */
export function answerRows(question: EeoQuestion, report: EeoReport | undefined): (EeoAnswerRow & { label: string })[] {
  const q = EEO_QUESTIONS.find((x) => x.id === question)!
  const got = new Map((report?.questions[question] ?? []).map((r) => [r.answer, r]))
  const zero = (answer: string): EeoAnswerRow => ({ answer, applicants: 0, past_review: 0, offer: 0, hired: 0 })
  return [
    ...q.options.map((o) => ({ ...(got.get(o.value) ?? zero(o.value)), label: o.label })),
    { ...(got.get(NOT_ANSWERED) ?? zero(NOT_ANSWERED)), label: "Didn't answer" },
  ]
}

/** A count as shown: the number, or "Fewer than 5" for a hidden small group. */
export function cellText(v: EeoCell, minGroup = 5): string {
  return v === null ? `Fewer than ${minGroup}` : v.toLocaleString('en-US')
}

/** Share of all applicants in the period, or null when the count is hidden or there's nobody. */
export function share(v: EeoCell, total: number): number | null {
  if (v === null || total <= 0) return null
  return Math.round((v / total) * 1000) / 10
}

/** The CSV: one line per question and answer, totals only. */
export function eeoCsvRows(report: EeoReport): { header: string[]; rows: (string | number)[][] } {
  const header = ['Question', 'Answer', 'Applicants', 'Share of applicants (%)', 'Past application review', 'Reached offer', 'Hired']
  const rows: (string | number)[][] = []
  for (const q of EEO_QUESTIONS) {
    for (const r of answerRows(q.id, report)) {
      const pct = share(r.applicants, report.applicants)
      rows.push([
        q.title,
        r.label,
        cellText(r.applicants, report.min_group),
        pct === null ? '' : pct,
        cellText(r.past_review, report.min_group),
        cellText(r.offer, report.min_group),
        cellText(r.hired, report.min_group),
      ])
    }
  }
  return { header, rows }
}

export function useEeoReport(tenantId: string | undefined, period: EeoPeriod, jobId: string | null) {
  return useQuery({
    queryKey: ['eeo-report', tenantId, period, jobId],
    enabled: !!tenantId,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<EeoReport> => {
      const range = eeoPeriodRange(period, new Date())
      // `eeo_report` arrives in the generated types once the migration is applied.
      const rpc = supabase.rpc.bind(supabase) as unknown as (
        fn: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message: string; code?: string } | null }>
      const { data, error } = await rpc('eeo_report', {
        p_tenant: tenantId,
        p_from: range?.from ?? null,
        p_to: range?.to ?? null,
        p_job: jobId,
      })
      if (error) throw error
      return data as EeoReport
    },
  })
}

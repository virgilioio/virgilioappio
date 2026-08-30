/**
 * Pairing a referee's stored answers with the questions that were asked.
 *
 * Answers are stored per referee, keyed by question id, as scalars (with
 * `{ title, start, end }` for employment verification). Question order, labels
 * and configuration come from the request's FROZEN `template_snapshot` — never
 * the live template, so editing a template can't reword a question a referee
 * already answered.
 *
 * There is deliberately no `match` field anywhere in here: employment
 * verification is capture only, never an automated comparison.
 */
import type { RefQuestion } from '@/lib/references/templateModel'

export interface ResolvedAnswer {
  /** Mirrors the question type. */
  type: string
  /** Scalar, or string[] for multi_select. */
  value?: unknown
  /** employment_verification. */
  title?: string
  from?: string
  to?: string
  /** date_range display suffix, e.g. "4 yr 10 mo". */
  duration?: string
  /** number. */
  unit?: string
}

export interface ResolvedQuestionAnswer {
  question: RefQuestion
  answer: ResolvedAnswer | null
}

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return true
  if (Array.isArray(v) && v.length === 0) return true
  return false
}

function resolveOne(q: RefQuestion, raw: unknown): ResolvedAnswer | null {
  if (q.type === 'employment_verification') {
    const v = (raw ?? {}) as Record<string, unknown>
    const title = (v.title ?? '') as string
    const from = ((v.from ?? v.start) ?? '') as string
    const to = ((v.to ?? v.end) ?? '') as string
    if (!title && !from && !to) return null
    return { type: q.type, title, from, to }
  }

  // Forward-compatible: an already-shaped record wins over the scalar form.
  if (raw && typeof raw === 'object' && !Array.isArray(raw) && 'value' in (raw as any)) {
    const rec = raw as Record<string, unknown>
    if (isEmpty(rec.value)) return null
    return {
      type: q.type,
      value: rec.value,
      duration: rec.duration as string | undefined,
      unit: (rec.unit as string | undefined) ?? q.unit,
    }
  }

  if (isEmpty(raw)) return null
  return { type: q.type, value: raw, unit: q.unit }
}

/** Questions in template order, each paired with this referee's own answer. */
export function resolveAnswers(
  questions: RefQuestion[] | null | undefined,
  answers: Record<string, unknown> | null | undefined,
): ResolvedQuestionAnswer[] {
  const map = (answers ?? {}) as Record<string, unknown>
  return (questions ?? []).map((q) => ({
    question: q,
    answer: q.type === 'section_header' ? null : resolveOne(q, map[q.id]),
  }))
}

/** The candidate's own 1–5 score for this question, when they answered it. */
export function candidateSelfScore(
  self: Record<string, unknown> | null | undefined,
  questionId: string,
): number | null {
  const raw = self?.[questionId]
  const n = typeof raw === 'string' ? Number(raw) : typeof raw === 'number' ? raw : NaN
  return Number.isFinite(n) ? n : null
}

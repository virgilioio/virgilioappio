// Interview notes, step 4 (2026-11-12): one note structure for Gio's drafts
// (generate-scorecard-from-transcript) and Polish notes (polish-scorecard-notes).
//
// The model returns the notes as data (submit_interview_notes); the server writes
// them as Markdown once, in the interview's language (the model supplies the
// headings and labels), and settles the recommendation against the job:
//   Summary, Strengths, Concerns, Motivation & logistics, Not covered,
//   Recommendation (rating, confidence, why, and each requirement with its evidence).
// The scorecard's draft card draws Markdown; Apply turns it into the box's HTML.
// Plain ASCII only (the function deploy tool rewrites escape sequences).

import { SUGGESTED_RATINGS, toSuggestedRating, type SuggestedRating } from './interviewNotes.ts'
import { clock } from './fireflies.ts'

// -- The job's requirements ----------------------------------------------------------

export type CriterionKind = 'must' | 'nice' | 'years' | 'location' | 'salary'
export type Verdict = 'met' | 'partly' | 'not_met' | 'not_discussed'
export const VERDICTS: Verdict[] = ['met', 'partly', 'not_met', 'not_discussed']

export interface Criterion {
  id: string
  kind: CriterionKind
  label: string
}

export interface JobForNotes {
  title?: string | null
  description?: string | null
  skills?: string[] | null
  skill_priorities?: Record<string, string> | null
  min_years_experience?: number | null
  max_years_experience?: number | null
  location?: string | null
  additional_locations?: string[] | null
  location_requirement?: string | null
  work_mode?: string | null
  salary_min?: number | null
  salary_max?: number | null
  salary_period?: string | null
  currency?: string | null
  budget_salary_min?: number | null
  budget_salary_max?: number | null
  budget_currency?: string | null
  budget_period?: string | null
}

/** Gio Fit's priority rule: must, nice, or bonus ("extra", never a gap). */
export function priorityOf(job: JobForNotes, skill: string): 'must' | 'nice' | 'bonus' {
  const map = (job.skill_priorities && typeof job.skill_priorities === 'object' ? job.skill_priorities : {}) as Record<string, string>
  const direct = map[skill]
  if (direct === 'must' || direct === 'nice' || direct === 'bonus') return direct
  const hit = Object.entries(map).find(([name]) => name.trim().toLowerCase() === skill.trim().toLowerCase())
  return hit && (hit[1] === 'must' || hit[1] === 'bonus') ? (hit[1] as 'must' | 'bonus') : 'nice'
}

/** The pay range the notes measure against: the posted band, else the budget. */
export function payBand(job: JobForNotes): { min: number | null; max: number | null; currency: string; period: string } | null {
  const posted = job.salary_min != null || job.salary_max != null
  const min = posted ? job.salary_min ?? null : job.budget_salary_min ?? null
  const max = posted ? job.salary_max ?? null : job.budget_salary_max ?? null
  if (min == null && max == null) return null
  const currency = String((posted ? job.currency : job.budget_currency) || job.currency || 'USD').toUpperCase()
  const period = posted ? String(job.salary_period || 'annually') : String(job.budget_period || 'monthly')
  return { min, max, currency, period }
}

const PERIOD_WORD: Record<string, string> = {
  annual: 'a year', annually: 'a year', yearly: 'a year', year: 'a year',
  monthly: 'a month', month: 'a month', hourly: 'an hour', hour: 'an hour', weekly: 'a week',
}
export const periodWord = (p: string) => PERIOD_WORD[String(p || '').toLowerCase()] ?? String(p || '')
const money = (n: number) => Math.round(n).toLocaleString('en-US')

const MAX_NICE = 6

/** What the recommendation is measured against, each with a stable id (c1, c2, ...). */
export function jobCriteria(job: JobForNotes): Criterion[] {
  const out: Omit<Criterion, 'id'>[] = []
  const skills = (Array.isArray(job.skills) ? job.skills : []).map((s) => String(s || '').trim()).filter(Boolean)
  for (const s of skills) if (priorityOf(job, s) === 'must') out.push({ kind: 'must', label: s })
  for (const s of skills.filter((s) => priorityOf(job, s) === 'nice').slice(0, MAX_NICE)) out.push({ kind: 'nice', label: s })
  const lo = job.min_years_experience, hi = job.max_years_experience
  if (lo != null || hi != null) {
    const label = lo != null && hi != null ? `${lo}-${hi} years of experience` : lo != null ? `At least ${lo} years of experience` : `Up to ${hi} years of experience`
    out.push({ kind: 'years', label })
  }
  const places = [job.location, ...(Array.isArray(job.additional_locations) ? job.additional_locations : [])]
    .map((p) => String(p || '').trim())
    .filter(Boolean)
  const uniquePlaces = [...new Set(places)]
  if (uniquePlaces.length) {
    const mode = job.work_mode ? ` (${String(job.work_mode).replace(/_/g, ' ')})` : ''
    out.push({ kind: 'location', label: `Based in ${uniquePlaces.join(' or ')}${mode}` })
  }
  const band = payBand(job)
  if (band) {
    const range = band.min != null && band.max != null
      ? `${band.currency} ${money(band.min)}-${money(band.max)}`
      : band.max != null ? `up to ${band.currency} ${money(band.max)}` : `from ${band.currency} ${money(band.min as number)}`
    out.push({ kind: 'salary', label: `Salary within ${range} ${periodWord(band.period)}` })
  }
  return out.map((c, i) => ({ ...c, id: `c${i + 1}` }))
}

/** The requirements as the model reads them. */
export function criteriaPrompt(criteria: Criterion[], job: JobForNotes): string {
  if (!criteria.length) return 'JOB REQUIREMENTS: none are set on this job, so judge only against the job description.'
  const kindWord: Record<CriterionKind, string> = { must: 'must-have', nice: 'nice-to-have', years: 'experience', location: 'location', salary: 'salary' }
  const extras = (Array.isArray(job.skills) ? job.skills : []).filter((s) => priorityOf(job, s) === 'bonus')
  return [
    'JOB REQUIREMENTS TO JUDGE (one verdict each, by id):',
    ...criteria.map((c) => `- [${c.id}] ${c.label} (${kindWord[c.kind]})`),
    extras.length ? `Extras (a plus when they come up, never a gap): ${extras.join(', ')}` : '',
  ].filter(Boolean).join('\n')
}

// -- Scorecard questions -------------------------------------------------------------

export interface QuestionForNotes {
  id: string
  question_text: string
  answer_type: string
  select_options?: unknown
  salary_config?: { currency?: string; period?: string } | null
}

interface Option { value: string; label: string }
export function optionsOf(q: QuestionForNotes): Option[] {
  const raw = Array.isArray(q.select_options) ? q.select_options : []
  return raw
    .map((o: any) => (typeof o === 'string' ? { value: o, label: o } : { value: String(o?.value ?? o?.label ?? ''), label: String(o?.label ?? o?.value ?? '') }))
    .filter((o) => o.value)
}

const TEXT_TYPES = new Set(['text', 'longtext', 'number', 'email', 'url', 'date', 'location', 'phone', 'linkedin', 'employment_type', 'work_location'])
/** Types Gio never fills: a file, a team member to route to. */
const SKIP_TYPES = new Set(['file', 'recruiter'])

export function questionsPrompt(questions: QuestionForNotes[]): string {
  const asked = questions.filter((q) => !SKIP_TYPES.has(q.answer_type))
  if (!asked.length) return ''
  const how = (q: QuestionForNotes) => {
    switch (q.answer_type) {
      case 'yes_no': return 'answer_text "yes" or "no"'
      case 'single_select': return `option: exactly one of ${optionsOf(q).map((o) => `"${o.value}"`).join(', ')}`
      case 'multi_select': return `options: any of ${optionsOf(q).map((o) => `"${o.value}"`).join(', ')}`
      case 'score_1_5': return `rating: one of ${SUGGESTED_RATINGS.join(', ')}`
      case 'salary_expectations': return 'the amount goes in stated_salary (with its currency and period as said); set discussed'
      case 'location': return 'answer_text "City, State, Country"'
      default: return 'answer_text, short and factual'
    }
  }
  return [
    'SCORECARD QUESTIONS (answer only from what was said; set discussed false when it did not come up, and leave the answer empty):',
    ...asked.map((q) => `- [${q.id}] "${q.question_text}" (${q.answer_type}): ${how(q)}`),
  ].join('\n')
}

export interface ModelAnswer {
  question_id?: string
  discussed?: boolean
  answer_text?: string
  option?: string
  options?: string[]
  rating?: string
}

export interface StatedSalary {
  amount?: number | string
  currency?: string
  period?: string
  quote?: string
  at?: string
}

export interface AnswerRow {
  question_id: string
  answer_text: string | null
  answer_options: string[] | null
}

const pickOption = (q: QuestionForNotes, v: unknown): string | null => {
  const s = String(v ?? '').trim().toLowerCase()
  if (!s) return null
  const hit = optionsOf(q).find((o) => o.value.toLowerCase() === s || o.label.toLowerCase() === s)
  return hit ? hit.value : null
}

export const salaryAmount = (s: StatedSalary | null | undefined): number | null => {
  if (!s) return null
  const n = typeof s.amount === 'number' ? s.amount : Number(String(s.amount ?? '').replace(/[^0-9.]/g, ''))
  return Number.isFinite(n) && n > 0 ? n : null
}

/**
 * Gio's answers in the shape the scorecard sheet reads (2026-11-12): Yes/No, single
 * select and score in answer_text (the option's value, the rating), multi select in
 * answer_options, salary as a number in the question's own currency and period.
 * Nothing for a question that wasn't discussed, so a required one still waits for
 * the interviewer.
 */
export function answerRows(
  questions: QuestionForNotes[],
  answers: ModelAnswer[],
  stated: StatedSalary | null,
  convert: (amount: number, fromCurrency: string, fromPeriod: string, toCurrency: string, toPeriod: string) => number | null,
): AnswerRow[] {
  const byId = new Map(questions.map((q) => [q.id, q]))
  const rows: AnswerRow[] = []
  const seen = new Set<string>()
  const add = (question_id: string, answer_text: string | null, answer_options: string[] | null = null) => {
    if (seen.has(question_id)) return
    seen.add(question_id)
    rows.push({ question_id, answer_text, answer_options })
  }
  for (const a of Array.isArray(answers) ? answers : []) {
    const q = a?.question_id ? byId.get(a.question_id) : undefined
    if (!q || a.discussed === false || SKIP_TYPES.has(q.answer_type)) continue
    const text = String(a.answer_text ?? '').trim()
    if (/^\[?not discussed/i.test(text)) continue
    switch (q.answer_type) {
      case 'yes_no': {
        const v = (text || String(a.option ?? '')).toLowerCase()
        if (v === 'yes' || v === 'no') add(q.id, v)
        break
      }
      case 'single_select': {
        const v = pickOption(q, a.option ?? text)
        if (v) add(q.id, v)
        break
      }
      case 'multi_select': {
        const vs = [...new Set((Array.isArray(a.options) ? a.options : []).map((o) => pickOption(q, o)).filter(Boolean) as string[])]
        if (vs.length) add(q.id, null, vs)
        break
      }
      case 'score_1_5': {
        const r = toSuggestedRating(a.rating ?? text)
        if (r) add(q.id, r)
        break
      }
      case 'salary_expectations':
        break // from stated_salary, below
      default:
        if (TEXT_TYPES.has(q.answer_type) && text) add(q.id, text)
    }
  }
  const amount = salaryAmount(stated)
  if (amount != null) {
    for (const q of questions.filter((q) => q.answer_type === 'salary_expectations')) {
      const toCurrency = String(q.salary_config?.currency || 'USD').toUpperCase()
      const toPeriod = String(q.salary_config?.period || 'annually')
      const v = convert(amount, String(stated?.currency || toCurrency).toUpperCase(), String(stated?.period || toPeriod), toCurrency, toPeriod)
      if (v != null && v > 0) add(q.id, String(Math.round(v)))
    }
  }
  return rows
}

// -- The recommendation --------------------------------------------------------------

export type Confidence = 'high' | 'medium' | 'low'

export interface ModelCriterion {
  id?: string
  verdict?: string
  evidence?: string
  quote?: string
  at?: string
}

export interface SettledCriterion extends Criterion {
  verdict: Verdict
  evidence: string
  quote: string | null
  /** Seconds from the start of the call, when the model gave a time. */
  at: number | null
}

export interface Recommendation {
  rating: SuggestedRating | null
  confidence: Confidence
  reason: string
  language: string | null
  source_kind: 'summary' | 'transcript'
  criteria: SettledCriterion[]
  generated_at: string
}

/** "12:05" or "1:02:05" to seconds; null for anything else. */
export function parseClock(v: unknown): number | null {
  const m = String(v ?? '').trim().match(/^(?:(\d{1,2}):)?(\d{1,2}):(\d{2})$/)
  if (!m) return null
  return (Number(m[1] || 0) * 3600) + Number(m[2]) * 60 + Number(m[3])
}

/**
 * Gio Fit's salary rule, on the same currency and period: inside the range is met;
 * up to 25% above is negotiable (partly); more is not met; up to 25% under is good
 * news (met); more than 25% under is a question (partly).
 */
export function salaryVerdict(amount: number, min: number | null, max: number | null): Verdict {
  if (max != null && amount > max) return amount <= max * 1.25 ? 'partly' : 'not_met'
  if (min != null && amount < min) return amount >= min * 0.75 ? 'met' : 'partly'
  return 'met'
}

const RANK: Record<SuggestedRating, number> = { strong_no: 0, lean_no: 1, lean_yes: 2, yes: 3, strong_yes: 4 }
const lower = (a: Confidence, b: Confidence): Confidence => (['low', 'medium', 'high'].indexOf(a) <= ['low', 'medium', 'high'].indexOf(b) ? a : b)

/**
 * The recommendation the scorecard shows, from the model's answer and the job's own
 * requirements. The model can't add requirements (only the job's are kept); nothing
 * judged means no rating; a must-have the interview showed missing keeps the rating
 * at lean no or below; a summary-only source is never more than low confidence, and
 * must-haves left undiscussed take high down to medium.
 */
export function settleRecommendation(
  model: { rating?: string; confidence?: string; reason?: string } | null | undefined,
  modelCriteria: ModelCriterion[] | null | undefined,
  criteria: Criterion[],
  ctx: { full: boolean; sourceKind: 'summary' | 'transcript'; language: string | null; salaryVerdict?: Verdict | null },
): Recommendation {
  const given = new Map((Array.isArray(modelCriteria) ? modelCriteria : []).filter((c) => c?.id).map((c) => [String(c.id), c]))
  const settled: SettledCriterion[] = criteria.map((c) => {
    const m = given.get(c.id)
    let verdict: Verdict = VERDICTS.includes(m?.verdict as Verdict) ? (m!.verdict as Verdict) : 'not_discussed'
    if (c.kind === 'salary' && ctx.salaryVerdict) verdict = ctx.salaryVerdict
    const quote = ctx.full ? String(m?.quote ?? '').trim() || null : null
    return {
      ...c,
      verdict,
      evidence: verdict === 'not_discussed' ? '' : String(m?.evidence ?? '').trim(),
      quote: verdict === 'not_discussed' ? null : quote,
      at: verdict === 'not_discussed' || !ctx.full ? null : parseClock(m?.at),
    }
  })
  let rating = toSuggestedRating(model?.rating)
  let confidence: Confidence = model?.confidence === 'high' || model?.confidence === 'medium' ? model.confidence : 'low'
  const judged = settled.filter((c) => c.verdict !== 'not_discussed')
  if (criteria.length && !judged.length) rating = null
  const musts = settled.filter((c) => c.kind === 'must')
  if (rating && musts.some((c) => c.verdict === 'not_met') && RANK[rating] > RANK.lean_no) rating = 'lean_no'
  if (musts.length && musts.filter((c) => c.verdict === 'not_discussed').length * 2 >= musts.length) confidence = lower(confidence, 'medium')
  if (ctx.sourceKind === 'summary') confidence = 'low'
  return {
    rating,
    confidence,
    reason: String(model?.reason ?? '').trim(),
    language: ctx.language,
    source_kind: ctx.full ? 'transcript' : ctx.sourceKind,
    criteria: settled,
    generated_at: new Date().toISOString(),
  }
}

// -- The model's tool ----------------------------------------------------------------

const point = {
  type: 'object',
  properties: {
    point: { type: 'string', description: 'The strength or concern in a few words' },
    evidence: { type: 'string', description: 'What was said that shows it, in one sentence' },
    quote: { type: 'string', description: 'Exact words from the transcript (empty when the source is a summary)' },
    at: { type: 'string', description: 'When it was said, m:ss or h:mm:ss (empty without a transcript)' },
  },
  required: ['point', 'evidence'],
}

export const LABEL_KEYS = [
  'summary', 'strengths', 'concerns', 'motivation', 'not_covered', 'recommendation', 'requirements',
  'met', 'partly', 'not_met', 'not_discussed', 'confidence', 'high', 'medium', 'low',
  'must', 'nice', 'years', 'location', 'salary',
  'strong_yes', 'yes', 'lean_yes', 'lean_no', 'strong_no', 'not_enough', 'from_summary',
] as const
export type LabelKey = (typeof LABEL_KEYS)[number]

export const ENGLISH_LABELS: Record<LabelKey, string> = {
  summary: 'Summary', strengths: 'Strengths', concerns: 'Concerns', motivation: 'Motivation & logistics',
  not_covered: 'Not covered', recommendation: 'Recommendation', requirements: 'Against the job',
  met: 'Met', partly: 'Partly', not_met: 'Not met', not_discussed: 'Not discussed',
  confidence: 'Confidence', high: 'high', medium: 'medium', low: 'low',
  must: 'must-have', nice: 'nice-to-have', years: 'experience', location: 'location', salary: 'salary',
  strong_yes: 'Strong yes', yes: 'Yes', lean_yes: 'Lean yes', lean_no: 'Lean no', strong_no: 'Strong no',
  not_enough: 'Not enough to recommend',
  from_summary: "From the note-taker's summary, not the full transcript.",
}

/** The one tool both functions ask for. `withQuestions` adds the scorecard answers. */
export function notesTool(withQuestions: boolean) {
  const properties: Record<string, unknown> = {
    language: { type: 'string', description: 'BCP 47 code of the language the interview was held in, e.g. es, en, pt-BR' },
    labels: {
      type: 'object',
      description: 'These words in the interview\'s language: ' + LABEL_KEYS.map((k) => `${k} = "${ENGLISH_LABELS[k]}"`).join('; '),
      properties: Object.fromEntries(LABEL_KEYS.map((k) => [k, { type: 'string' }])),
      required: [...LABEL_KEYS],
    },
    summary: { type: 'string', description: '2-4 sentences: who the candidate is and how the conversation went' },
    strengths: { type: 'array', items: point, description: '2-5, each with its evidence' },
    concerns: { type: 'array', items: point, description: '0-4, each with its evidence; none invented' },
    motivation_logistics: { type: 'array', items: { type: 'string' }, description: 'Why they are looking, notice period, location, work arrangement, salary as stated; only what was said' },
    not_covered: { type: 'array', items: { type: 'string' }, description: 'Job requirements or questions that did not come up and are worth asking next' },
    criteria: {
      type: 'array',
      description: 'One entry per job requirement id',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          verdict: { type: 'string', enum: VERDICTS },
          evidence: { type: 'string' },
          quote: { type: 'string' },
          at: { type: 'string' },
        },
        required: ['id', 'verdict'],
      },
    },
    stated_salary: {
      type: 'object',
      description: 'The salary the candidate asked for, as they said it; leave it out when pay did not come up',
      properties: {
        amount: { type: 'number' },
        currency: { type: 'string', description: 'ISO code, e.g. USD, MXN' },
        period: { type: 'string', enum: ['annually', 'monthly', 'hourly'] },
        quote: { type: 'string' },
        at: { type: 'string' },
      },
    },
    recommendation: {
      type: 'object',
      properties: {
        rating: { type: 'string', enum: [...SUGGESTED_RATINGS, 'not_enough'] },
        confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
        reason: { type: 'string', description: '2-3 sentences tying the rating to the requirements above' },
      },
      required: ['rating', 'confidence', 'reason'],
    },
  }
  const required = ['language', 'labels', 'summary', 'strengths', 'concerns', 'motivation_logistics', 'not_covered', 'criteria', 'recommendation']
  if (withQuestions) {
    properties.question_responses = {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          question_id: { type: 'string' },
          discussed: { type: 'boolean' },
          answer_text: { type: 'string' },
          option: { type: 'string' },
          options: { type: 'array', items: { type: 'string' } },
          rating: { type: 'string', enum: [...SUGGESTED_RATINGS] },
        },
        required: ['question_id', 'discussed'],
      },
    }
    required.push('question_responses')
  }
  return {
    type: 'function' as const,
    function: {
      name: 'submit_interview_notes',
      description: 'Submit the interview notes, the verdict on each job requirement and the recommendation',
      parameters: { type: 'object', properties, required },
    },
  }
}

/** The rules both prompts share. */
export const NOTES_RULES = `HOW TO WRITE THE NOTES
- Base every line on what was said in the interview (or written in the interviewer's notes). The resume, profile and job description are context only: never use them as evidence.
- Strengths and concerns each carry their evidence. Never invent a concern to balance the notes, and never pad a short call.
- Motivation & logistics: why they are looking, notice period, where they are based, the work arrangement they want, and pay, only as stated.
- Not covered: job requirements and scorecard questions that did not come up, so the next interviewer can ask.
- Judge every job requirement by its id: met, partly, not_met, or not_discussed when it did not come up. Do not guess.
- Recommendation: a rating on the five-point scale measured against those requirements, or not_enough when too few were covered to judge. Never default to yes. Confidence says how much of what matters the conversation covered.
- Write everything, labels included, in the language the interview was held in, whatever the language of these instructions, the job or the resume.
- Plain sentences, no Markdown inside the fields.`

// -- Rendering -----------------------------------------------------------------------

export interface ModelNotes {
  language?: string
  labels?: Partial<Record<LabelKey, string>>
  summary?: string
  strengths?: { point?: string; evidence?: string; quote?: string; at?: string }[]
  concerns?: { point?: string; evidence?: string; quote?: string; at?: string }[]
  motivation_logistics?: string[]
  not_covered?: string[]
  criteria?: ModelCriterion[]
  stated_salary?: StatedSalary | null
  recommendation?: { rating?: string; confidence?: string; reason?: string }
  question_responses?: ModelAnswer[]
}

/** A language code the database accepts, or null. */
export function languageCode(v: unknown): string | null {
  const s = String(v ?? '').trim()
  return /^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8})*$/.test(s) ? s : null
}

/** Model text inside Markdown: one line, no HTML, no Markdown of its own. */
export function clean(s: unknown): string {
  return String(s ?? '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^[#>*\-\s]+/, '')
    .replace(/\*\*/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function labelsOf(notes: ModelNotes): Record<LabelKey, string> {
  const out = { ...ENGLISH_LABELS }
  const given = notes.labels && typeof notes.labels === 'object' ? notes.labels : {}
  for (const k of LABEL_KEYS) {
    const v = clean((given as Record<string, unknown>)[k])
    if (v && v.length <= 80) out[k] = v
  }
  return out
}

const withQuote = (evidence: string, quote: string | null | undefined, at: number | null, full: boolean) => {
  const parts = [clean(evidence)]
  const q = full ? clean(quote) : ''
  if (q) parts.push(`"${q.replace(/^"|"$/g, '')}"${at != null ? ` (${clock(at)})` : ''}`)
  else if (at != null && full) parts.push(`(${clock(at)})`)
  return parts.filter(Boolean).join(' ')
}

/** The notes as Markdown, in the interview's language. */
export function renderNotes(notes: ModelNotes, rec: Recommendation, opts: { full: boolean }): string {
  const L = labelsOf(notes)
  const out: string[] = []
  if (!opts.full && rec.source_kind === 'summary') out.push(`_${L.from_summary}_`, '')
  const section = (title: string, lines: string[]) => {
    if (!lines.some((l) => l.trim())) return
    out.push(`## ${title}`, '', ...lines, '')
  }
  section(L.summary, [clean(notes.summary)])
  const points = (list: ModelNotes['strengths']) =>
    (Array.isArray(list) ? list : [])
      .filter((p) => clean(p?.point))
      .map((p) => `- **${clean(p.point)}**${p.evidence || p.quote ? `: ${withQuote(p.evidence ?? '', p.quote, opts.full ? parseClock(p.at) : null, opts.full)}` : ''}`)
  section(L.strengths, points(notes.strengths))
  section(L.concerns, points(notes.concerns))
  section(L.motivation, (Array.isArray(notes.motivation_logistics) ? notes.motivation_logistics : []).map((l) => clean(l)).filter(Boolean).map((l) => `- ${l}`))
  section(L.not_covered, (Array.isArray(notes.not_covered) ? notes.not_covered : []).map((l) => clean(l)).filter(Boolean).map((l) => `- ${l}`))

  const ratingWord = rec.rating ? L[rec.rating] : L.not_enough
  const head = `**${ratingWord}** - ${L.confidence}: ${L[rec.confidence]}`
  const reqs = rec.criteria.map((c) => {
    const detail = c.verdict === 'not_discussed' ? '' : withQuote(c.evidence, c.quote, c.at, opts.full)
    const tag = c.kind === 'must' || c.kind === 'nice' ? ` (${L[c.kind]})` : ''
    return `- ${L[c.verdict]} - ${clean(c.label)}${tag}${detail ? `: ${detail}` : ''}`
  })
  section(L.recommendation, [head, '', clean(rec.reason), ...(reqs.length ? ['', `**${L.requirements}**`, '', ...reqs] : [])])
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim()
}

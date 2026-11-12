import { describe, expect, it } from 'vitest'
import {
  answerRows,
  clean,
  criteriaPrompt,
  jobCriteria,
  languageCode,
  notesTool,
  parseClock,
  renderNotes,
  salaryVerdict,
  settleRecommendation,
  type JobForNotes,
  type ModelNotes,
} from '../interviewNotesFormat'

// The Head of Marketing (Partnership Leaders) job's settings, as stored.
const JOB: JobForNotes = {
  title: 'Head of Marketing',
  skills: [
    'Professional Services Marketing', 'Enterprise Demand Generation', 'C-level Executive Engagement',
    'Marketing Team Management', 'HubSpot', 'AI Marketing Workflows', 'Community-led Growth', 'Event-led Growth',
    'Content Strategy or Thought Leadership', 'Gartner or Forrester Experience', 'Advisory or Consulting Marketing',
    'Agency Management', 'Start-up or Scale-up Experience',
  ],
  skill_priorities: {
    HubSpot: 'nice', 'Event-led Growth': 'nice', 'Agency Management': 'bonus', 'Community-led Growth': 'nice',
    'AI Marketing Workflows': 'nice', 'Marketing Team Management': 'must', 'C-level Executive Engagement': 'must',
    'Enterprise Demand Generation': 'must', 'Gartner or Forrester Experience': 'bonus',
    'Professional Services Marketing': 'must', 'Start-up or Scale-up Experience': 'bonus',
    'Advisory or Consulting Marketing': 'bonus', 'Content Strategy or Thought Leadership': 'nice',
  },
  min_years_experience: 10,
  max_years_experience: 20,
  location: 'United States',
  additional_locations: ['United States', 'Canada'],
  work_mode: 'remote',
  salary_min: 180000,
  salary_max: 250000,
  salary_period: 'annual',
  currency: 'USD',
  budget_currency: 'MXN',
  budget_period: 'monthly',
}

describe('jobCriteria', () => {
  it('lists musts, then nice-to-haves, years, location and pay; never the extras', () => {
    const c = jobCriteria(JOB)
    expect(c.map((x) => x.kind)).toEqual(['must', 'must', 'must', 'must', 'nice', 'nice', 'nice', 'nice', 'nice', 'years', 'location', 'salary'])
    expect(c[0]).toEqual({ id: 'c1', kind: 'must', label: 'Professional Services Marketing' })
    expect(c.find((x) => x.kind === 'years')?.label).toBe('10-20 years of experience')
    expect(c.find((x) => x.kind === 'location')?.label).toBe('Based in United States or Canada (remote)')
    expect(c.find((x) => x.kind === 'salary')?.label).toBe('Salary within USD 180,000-250,000 a year')
    expect(c.some((x) => x.label === 'Agency Management')).toBe(false)
    expect(criteriaPrompt(c, JOB)).toContain('Extras (a plus when they come up, never a gap): Gartner or Forrester Experience, Advisory or Consulting Marketing, Agency Management, Start-up or Scale-up Experience')
  })
  it('falls back to the budget when no band is posted, and says when nothing is set', () => {
    const c = jobCriteria({ budget_salary_min: 60000, budget_salary_max: 80000, budget_currency: 'MXN', budget_period: 'monthly' })
    expect(c).toEqual([{ id: 'c1', kind: 'salary', label: 'Salary within MXN 60,000-80,000 a month' }])
    expect(criteriaPrompt([], {})).toMatch(/none are set/)
  })
})

describe('salaryVerdict (Gio Fit rule)', () => {
  it('reads the band symmetrically', () => {
    expect(salaryVerdict(210000, 180000, 250000)).toBe('met')
    expect(salaryVerdict(300000, 180000, 250000)).toBe('partly')
    expect(salaryVerdict(330000, 180000, 250000)).toBe('not_met')
    expect(salaryVerdict(150000, 180000, 250000)).toBe('met')
    expect(salaryVerdict(120000, 180000, 250000)).toBe('partly')
  })
})

describe('settleRecommendation', () => {
  const criteria = jobCriteria(JOB)
  const all = (verdict: string) => criteria.map((c) => ({ id: c.id, verdict, evidence: 'said so', quote: 'we did it', at: '12:05' }))
  const ctx = { full: true, sourceKind: 'transcript' as const, language: 'es' }

  it('keeps only the job\'s requirements, with times in seconds', () => {
    const r = settleRecommendation({ rating: 'yes', confidence: 'high', reason: 'Strong fit' }, [...all('met'), { id: 'c99', verdict: 'met' }], criteria, ctx)
    expect(r.criteria).toHaveLength(criteria.length)
    expect(r.criteria[0]).toMatchObject({ verdict: 'met', quote: 'we did it', at: 725 })
    expect(r).toMatchObject({ rating: 'yes', confidence: 'high', language: 'es', source_kind: 'transcript' })
  })
  it('gives no rating when nothing was judged', () => {
    expect(settleRecommendation({ rating: 'strong_yes', confidence: 'high' }, all('not_discussed'), criteria, ctx).rating).toBeNull()
    expect(settleRecommendation({ rating: 'not_enough', confidence: 'low' }, all('met'), criteria, ctx).rating).toBeNull()
  })
  it('keeps a missing must-have at lean no or below', () => {
    const crit = all('met')
    crit[1].verdict = 'not_met'
    expect(settleRecommendation({ rating: 'strong_yes', confidence: 'high' }, crit, criteria, ctx).rating).toBe('lean_no')
    expect(settleRecommendation({ rating: 'strong_no', confidence: 'high' }, crit, criteria, ctx).rating).toBe('strong_no')
  })
  it("keeps the interviewer's own confidence for their notes (Polish notes)", () => {
    expect(settleRecommendation({ rating: 'yes', confidence: 'high' }, all('met'), criteria, { full: false, sourceKind: 'transcript', language: 'en' }).confidence).toBe('high')
  })
  it('lowers confidence for undiscussed must-haves and for a summary', () => {
    const crit = all('met')
    crit[0].verdict = 'not_discussed'
    crit[1].verdict = 'not_discussed'
    expect(settleRecommendation({ rating: 'yes', confidence: 'high' }, crit, criteria, ctx).confidence).toBe('medium')
    const s = settleRecommendation({ rating: 'yes', confidence: 'high' }, all('met'), criteria, { full: false, sourceKind: 'summary', language: 'en' })
    expect(s).toMatchObject({ confidence: 'low', source_kind: 'summary' })
    expect(s.criteria[0]).toMatchObject({ quote: null, at: null })
  })
  it('lets the server decide pay from the stated figure', () => {
    const r = settleRecommendation({ rating: 'yes', confidence: 'high' }, all('met'), criteria, { ...ctx, salaryVerdict: 'not_met' })
    expect(r.criteria.find((c) => c.kind === 'salary')?.verdict).toBe('not_met')
  })
})

describe('answerRows', () => {
  const questions = [
    { id: 'q1', question_text: 'Open to travel?', answer_type: 'yes_no' },
    { id: 'q2', question_text: 'Seniority', answer_type: 'single_select', select_options: [{ value: 'vp', label: 'VP' }, { value: 'director', label: 'Director' }] },
    { id: 'q3', question_text: 'Channels', answer_type: 'multi_select', select_options: [{ value: 'events', label: 'Events' }, { value: 'abm', label: 'ABM' }] },
    { id: 'q4', question_text: 'Communication', answer_type: 'score_1_5' },
    { id: 'q5', question_text: 'Salary?', answer_type: 'salary_expectations', salary_config: { currency: 'USD', period: 'annually' } },
    { id: 'q6', question_text: 'Notes', answer_type: 'longtext' },
    { id: 'q7', question_text: 'CV', answer_type: 'file' },
    { id: 'q8', question_text: 'Notice', answer_type: 'text' },
  ]
  const toAnnual = (n: number, _fc: string, fp: string) => (fp === 'monthly' ? n * 12 : n)

  it('writes each answer where the sheet reads it, and nothing for what was not discussed', () => {
    const rows = answerRows(
      questions,
      [
        { question_id: 'q1', discussed: true, answer_text: 'Yes' },
        { question_id: 'q2', discussed: true, option: 'Director' },
        { question_id: 'q3', discussed: true, options: ['ABM', 'events', 'radio'] },
        { question_id: 'q4', discussed: true, rating: 'lean_yes' },
        { question_id: 'q6', discussed: true, answer_text: 'Built a team of 12' },
        { question_id: 'q7', discussed: true, answer_text: 'x' },
        { question_id: 'q8', discussed: false, answer_text: 'Two weeks' },
        { question_id: 'zz', discussed: true, answer_text: 'ghost' },
      ],
      { amount: 17500, currency: 'USD', period: 'monthly' },
      toAnnual,
    )
    expect(rows).toEqual([
      { question_id: 'q1', answer_text: 'yes', answer_options: null },
      { question_id: 'q2', answer_text: 'director', answer_options: null },
      { question_id: 'q3', answer_text: null, answer_options: ['abm', 'events'] },
      { question_id: 'q4', answer_text: 'lean_yes', answer_options: null },
      { question_id: 'q6', answer_text: 'Built a team of 12', answer_options: null },
      { question_id: 'q5', answer_text: '210000', answer_options: null },
    ])
  })
  it('drops "[Not discussed]" texts and pay that can\'t be converted', () => {
    const rows = answerRows(questions, [{ question_id: 'q6', discussed: true, answer_text: '[Not discussed during this interview]' }], { amount: 100, currency: 'XYZ', period: 'annually' }, () => null)
    expect(rows).toEqual([])
  })
})

describe('renderNotes', () => {
  const criteria = jobCriteria(JOB).slice(0, 2)
  const notes: ModelNotes = {
    language: 'es',
    labels: { summary: 'Resumen', strengths: 'Fortalezas', concerns: 'Riesgos', recommendation: 'Recomendación', met: 'Cumple', not_discussed: 'No se habló', must: 'imprescindible', lean_yes: 'Más bien sí', confidence: 'Confianza', medium: 'media', requirements: 'Frente al puesto' },
    summary: 'Jordan lleva 15 años en marketing.\nHabló de alianzas.',
    strengths: [{ point: 'Demanda enterprise', evidence: 'Llevó pipeline a 40M', quote: 'subimos a 40 millones', at: '12:05' }],
    concerns: [],
    motivation_logistics: ['Busca un rol remoto'],
    not_covered: [],
  }
  it('writes the sections in the interview\'s language, with quotes and times', () => {
    const rec = settleRecommendation({ rating: 'lean_yes', confidence: 'medium', reason: 'Buen encaje <b>general</b>.' }, [{ id: 'c1', verdict: 'met', evidence: 'Marketing B2B de servicios', quote: 'consultoras', at: '3:10' }], criteria, { full: true, sourceKind: 'transcript', language: 'es' })
    const md = renderNotes(notes, rec, { full: true })
    expect(md.startsWith('## Resumen\n\nJordan lleva 15 años en marketing. Habló de alianzas.')).toBe(true)
    expect(md).toContain('## Fortalezas\n\n- **Demanda enterprise**: Llevó pipeline a 40M "subimos a 40 millones" (12:05)')
    expect(md).toContain('## Motivation & logistics\n\n- Busca un rol remoto')
    expect(md).not.toContain('## Riesgos')
    expect(md).toContain('## Recomendación\n\n**Más bien sí** - Confianza: media\n\nBuen encaje &lt;b&gt;general&lt;/b&gt;.')
    expect(md).toContain('- Cumple - Professional Services Marketing (imprescindible): Marketing B2B de servicios "consultoras" (3:10)')
    expect(md).toContain('- No se habló - Enterprise Demand Generation (imprescindible)')
  })
  it('says when it comes from the summary, and never quotes it', () => {
    const rec = settleRecommendation({ rating: 'not_enough', confidence: 'low', reason: 'Poco' }, [], criteria, { full: false, sourceKind: 'summary', language: 'en' })
    const md = renderNotes({ ...notes, labels: {} }, rec, { full: false })
    expect(md.startsWith("_From the note-taker's summary, not the full transcript._")).toBe(true)
    expect(md).toContain('**Not enough to recommend** - Confidence: low')
    expect(md).not.toContain('"subimos')
  })
})

describe('helpers', () => {
  it('parses clocks, cleans text, checks language codes, builds the tool', () => {
    expect(parseClock('1:02:05')).toBe(3725)
    expect(parseClock('soon')).toBeNull()
    expect(clean('## **Bold**\nnext')).toBe('Bold next')
    expect(languageCode('pt-BR')).toBe('pt-BR')
    expect(languageCode('Spanish')).toBeNull()
    expect(notesTool(true).function.parameters.required).toContain('question_responses')
    expect(notesTool(false).function.parameters.required).not.toContain('question_responses')
  })
})

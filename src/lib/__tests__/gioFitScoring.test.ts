import { describe, expect, it } from 'vitest'
import { reconcileSkillEvidence, skillKey, skillListBlock, type SkillPriority } from '../../../supabase/functions/analyze-candidate-fit/skills'
import { buildMustHaves, causeOf, settleScore, NOT_MET_POINTS, NOT_SHOWN_POINTS, type MustHave, type MustStatus } from '../../../supabase/functions/analyze-candidate-fit/scoring'
import { applicationAnswersBlock } from '../../../supabase/functions/analyze-candidate-fit/evidence'

const JOB = ['Classroom Management', 'Customer Success or Account Management', 'Apollo', 'SaaS', 'Higher Education or L&D']
const PRIORITY: Record<string, SkillPriority> = {
  'Classroom Management': 'must', 'Customer Success or Account Management': 'must', Apollo: 'must', SaaS: 'nice', 'Higher Education or L&D': 'bonus',
}
const priorityOf = (skill: string) => PRIORITY[skill] ?? 'nice'
const ev = (skill: string, status = 'evidenced') => ({ skill, status, evidence: status === 'not_evidenced' ? null : 'Managed a classroom of 30', source: 'the résumé' })

describe('skillKey', () => {
  it('drops the number, the quotes and the priority tag', () => {
    expect(skillKey('1. Classroom Management [must-have]')).toBe('classroom management')
    expect(skillKey('"Classroom Management" (priority: must-have)')).toBe('classroom management')
    expect(skillKey('3) Apollo — nice-to-have')).toBe('apollo')
    expect(skillKey('  SaaS   [extra] ')).toBe('saas')
    expect(skillKey('Higher Education or L&D')).toBe('higher education or l&d')
  })
  it('keeps brackets that are part of a name', () => {
    expect(skillKey('C# (.NET)')).toBe('c# (.net)')
    expect(skillKey('Sales (B2B)')).toBe('sales (b2b)')
  })
})

describe('reconcileSkillEvidence', () => {
  it('keeps verdicts returned with the tag the list used to show (the 2026-11-17 bug)', () => {
    const out = reconcileSkillEvidence(JOB, JOB.map((s, i) => ev(`${i + 1}. ${s} [${priorityOf(s) === 'must' ? 'must-have' : 'nice-to-have'}]`)), priorityOf)
    expect(out.entries.map((e) => e.status)).toEqual(['evidenced', 'evidenced', 'evidenced', 'evidenced', 'evidenced'])
    expect(out.entries.map((e) => e.skill)).toEqual(JOB)
    expect(out.unmatched).toEqual([])
    expect(out.missing).toEqual([])
  })

  it('takes either side of a skill the model split into its alternatives', () => {
    const out = reconcileSkillEvidence(JOB, [
      ev('Classroom Management', 'partial'),
      ev('Customer Success', 'not_evidenced'), ev('Account Management'),
      ev('Apollo', 'not_evidenced'), ev('SaaS'), ev('Higher Education'), ev('L&D', 'not_evidenced'),
    ], priorityOf)
    expect(out.entries.map((e) => e.status)).toEqual(['partial', 'evidenced', 'not_evidenced', 'evidenced', 'evidenced'])
    expect(out.unmatched).toEqual([])
  })

  it('falls back to position when a name was reworded but the list kept its length', () => {
    const out = reconcileSkillEvidence(['Full Cycle Sales', 'SaaS'], [ev('End-to-end selling'), ev('SaaS', 'partial')], () => 'nice')
    expect(out.entries.map((e) => e.status)).toEqual(['evidenced', 'partial'])
  })

  it('never guesses: no quote, no evidence, and an unknown name is reported', () => {
    const out = reconcileSkillEvidence(['Apollo', 'SaaS', 'HubSpot'], [
      { skill: 'Apollo', status: 'evidenced', evidence: '', source: null },
      { skill: 'Kubernetes', status: 'evidenced', evidence: 'Ran clusters', source: 'résumé' },
    ], () => 'must')
    expect(out.entries.map((e) => e.status)).toEqual(['not_evidenced', 'not_evidenced', 'not_evidenced'])
    expect(out.unquoted).toBe(1)
    expect(out.unmatched).toEqual(['Kubernetes'])
    expect(out.missing).toEqual(['SaaS', 'HubSpot'])
    expect(out.entries.every((e) => e.evidence === null && e.priority === 'must')).toBe(true)
  })

  it('survives nothing coming back', () => {
    expect(reconcileSkillEvidence(JOB, null, priorityOf).entries).toHaveLength(5)
    expect(reconcileSkillEvidence([], [ev('Apollo')], priorityOf).entries).toEqual([])
  })
})

describe('skillListBlock', () => {
  it('puts each name alone in quotes, one per line', () => {
    const block = skillListBlock(JOB, priorityOf)
    expect(block).toContain('1. "Classroom Management" (priority: must-have)')
    expect(block).toContain('5. "Higher Education or L&D" (priority: extra)')
    expect(block).not.toContain('[must-have]')
    expect(skillListBlock([], priorityOf)).toBe('')
  })
})

describe('buildMustHaves', () => {
  const skills = reconcileSkillEvidence(JOB, [ev('Classroom Management'), ev('Apollo', 'partial')], priorityOf).entries

  it('reads a must-have skill nothing mentions as not shown yet, never a miss', () => {
    const list = buildMustHaves([{ requirement: 'Fluent English', status: 'met', evidence: 'C2' }], skills)
    expect(list.map((m) => [m.requirement, m.status, !!m.from_skill])).toEqual([
      ['Fluent English', 'met', false],
      ['Skill: Classroom Management', 'met', true],
      ['Skill: Customer Success or Account Management', 'unknown', true],
      ['Skill: Apollo', 'partial', true],
    ])
  })

  it('lets explicit evidence make the miss, and a quoted skill settle an open must-have', () => {
    const list = buildMustHaves([
      { requirement: 'Apollo experience', status: 'not_met', evidence: 'Answered No on the application' },
      { requirement: 'Classroom Management in a school', status: 'unknown', evidence: null },
    ], skills)
    expect(list.find((m) => m.requirement.startsWith('Apollo'))).toMatchObject({ status: 'not_met', from_skill: true })
    expect(list.find((m) => m.requirement.startsWith('Classroom'))).toMatchObject({ status: 'met', from_skill: true })
    expect(list.filter((m) => m.requirement.startsWith('Skill:'))).toHaveLength(1)
  })

  it('drops malformed entries and keeps at most 8 from the description', () => {
    const many = Array.from({ length: 11 }, (_, i) => ({ requirement: `Req ${i}`, status: 'weird', evidence: '' }))
    const list = buildMustHaves([{ requirement: ' ', status: 'met' }, ...many], [])
    expect(list).toHaveLength(8)
    expect(list[0]).toEqual({ requirement: 'Req 0', status: 'unknown', evidence: null })
  })
})

describe('settleScore', () => {
  const dims = [{ name: 'Skills Alignment', score: 80, weight: 30 }, { name: 'Experience Level', score: 80, weight: 20 }]
  const must = (status: MustStatus, from_skill = false): MustHave => ({ requirement: 'x', status, evidence: null, from_skill })
  const strong = Array.from({ length: 3 }, () => ({ skill: 's', status: 'evidenced' as const, evidence: 'q', source: null, priority: 'nice' as const }))
  const run = (modelScore: number, mustHaves: MustHave[], extra: Partial<Parameters<typeof settleScore>[0]> = {}) =>
    settleScore({ modelScore, dimensions: dims, mustHaves, skills: strong, tenureFlag: 'green', ...extra })

  it('no longer flattens different candidates onto 70', () => {
    const a = run(72, [must('not_met'), must('not_met')])
    const b = run(85, [must('not_met'), must('not_met')])
    expect(a.overall).toBe(72 - 2 * NOT_MET_POINTS)
    expect(b.overall).toBe(85 - 2 * NOT_MET_POINTS)
    expect(b.overall).toBeGreaterThan(a.overall)
    expect(a.rules).toEqual(['2 must-haves not met: 16 points off.'])
  })

  it('charges less for a must-have skill that is simply not shown, and nothing for an open description must-have', () => {
    const out = run(78, [must('unknown', true), must('unknown', true), must('unknown', false), must('met')])
    expect(out.overall).toBe(78 - 2 * NOT_SHOWN_POINTS)
    expect(out.notShown).toBe(2)
    expect(out.rules).toEqual(['2 must-have skills not shown yet: 6 points off.'])
  })

  it('gives the points back when an interview shows the skill', () => {
    const before = run(78, [must('unknown', true), must('unknown', true)])
    const after = run(78, [must('met', true), must('met', true)])
    expect(after.overall - before.overall).toBe(6)
    expect(after.rules).toEqual([])
  })

  it('stops the deductions at their maximum', () => {
    const out = run(88, [...Array.from({ length: 5 }, () => must('not_met')), ...Array.from({ length: 6 }, () => must('unknown', true))])
    expect(out.deduction).toBe(24 + 9)
    expect(out.overall).toBe(88 - 33)
  })

  it('keeps the ceilings: dealbreaker, three strong matches, job-hopping, the dimension mean', () => {
    expect(run(90, [], { dimensions: [...dims, { name: 'Location Compatibility', score: 20, weight: 10 }] }).overall).toBe(55)
    expect(run(90, [], { skills: [] }).overall).toBe(80)
    expect(run(90, [], { tenureFlag: 'red' }).overall).toBe(69)
    expect(run(99, []).overall).toBe(90)
    expect(run(-5, []).overall).toBe(0)
  })

  it('counts a must-have skill that is met once, not twice', () => {
    const skills = [{ skill: 'a', status: 'evidenced' as const, evidence: 'q', source: null, priority: 'must' as const }]
    const out = settleScore({ modelScore: 90, dimensions: dims, mustHaves: [must('met', true)], skills, tenureFlag: 'green' })
    expect(out.overall).toBe(80)
  })
})

describe('causeOf', () => {
  const now = { job: 'j', profile: 'p', scorecards: 's', answers: 'a' }
  it('names what changed, interview evidence first', () => {
    expect(causeOf(null, now, 5, false)).toBe('first')
    expect(causeOf({ inputs: now, version: 4 }, now, 5, false)).toBe('recipe')
    expect(causeOf({ inputs: null, version: 5 }, now, 5, false)).toBe('recipe')
    expect(causeOf({ inputs: { ...now, scorecards: 'x', job: 'y' }, version: 5 }, now, 5, false)).toBe('scorecard')
    expect(causeOf({ inputs: { ...now, answers: 'x' }, version: 5 }, now, 5, false)).toBe('application')
    expect(causeOf({ inputs: { ...now, profile: 'x' }, version: 5 }, now, 5, false)).toBe('profile')
    expect(causeOf({ inputs: { ...now, job: 'x' }, version: 5 }, now, 5, false)).toBe('job')
    expect(causeOf({ inputs: now, version: 5 }, now, 5, true)).toBe('refresh')
    expect(causeOf({ inputs: now, version: 5 }, now, 5, false)).toBe('recheck')
  })
})

describe('applicationAnswersBlock', () => {
  it('keeps the questions about fit and leaves out contact details, pay, place and uploads', () => {
    const block = applicationAnswersBlock([
      { field_name: 'candidate_name', field_label: 'Full Name', field_value: 'Someone', field_type: 'text' },
      { field_name: 'phone', field_label: 'Phone Number', field_value: '555', field_type: 'text' },
      { field_name: 'salary_expectation_amount', field_label: 'Salary Expectation - Amount', field_value: '5000', field_type: 'number' },
      { field_name: 'loc', field_label: 'Where are you?', field_value: '{"city":"X"}', field_type: 'location' },
      { field_name: 'voice', field_label: 'Record an answer', field_value: '{"attachment_id":"1"}', field_type: 'audio' },
      { field_name: 'do_you_have_experience_using_hubspot', field_label: 'Do you have experience using HubSpot?', field_value: 'Yes, 3+ years', field_type: 'select' },
      { field_name: 'new_yes_no_question', field_label: 'Are you open to working in USA time zones?', field_value: 'true', field_type: 'checkbox' },
      { field_name: 'new_long_text_question', field_label: 'Describe one program you built', field_value: '<p>Built   an ABM  program</p>', field_type: 'textarea' },
      { field_name: 'empty', field_label: 'Anything else?', field_value: '  ', field_type: 'textarea' },
    ])
    expect(block.split('\n')).toEqual([
      "APPLICATION ANSWERS (the candidate's own answers on this job's application form):",
      '- Q: Do you have experience using HubSpot? → Yes, 3+ years',
      '- Q: Are you open to working in USA time zones? → Yes',
      '- Q: Describe one program you built → Built an ABM program',
    ])
  })
  it('is empty when nothing is worth reading, and stops at its size limit', () => {
    expect(applicationAnswersBlock([])).toBe('')
    expect(applicationAnswersBlock(null)).toBe('')
    const long = Array.from({ length: 10 }, (_, i) => ({ field_name: `q${i}`, field_label: `Q${i}`, field_value: 'x'.repeat(4000), field_type: 'textarea' }))
    expect(applicationAnswersBlock(long).split('\n')).toHaveLength(1 + 4)
  })
})

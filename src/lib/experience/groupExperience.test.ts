import { describe, expect, it } from 'vitest'
import { companyKey, experienceSummary, formatRoleDates, groupExperience, unionExperienceMonths, type ExperienceItem } from './groupExperience'

const role = (id: string, company: string, start: string, end: string | null, extra: Partial<ExperienceItem> = {}): ExperienceItem => ({
  id, company_name: company, title: id, start_date: start, end_date: end, is_current: end === null, ...extra,
})

describe('groupExperience', () => {
  it('merges a promotion', () => expect(groupExperience([role('lead', 'Linear', '2023-01-01', null), role('rep', 'Linear', '2021-01-01', '2022-12-01')])).toHaveLength(1))
  it('keeps a boomerang through another employer separate', () => expect(groupExperience([role('new', 'Stripe', '2024-01-01', null), role('middle', 'Notion', '2022-01-01', '2023-12-01'), role('old', 'Stripe', '2020-01-01', '2021-12-01')])).toHaveLength(3))
  it('splits a bare gap over three months', () => expect(groupExperience([role('new', 'Stripe', '2020-10-01', null), role('old', 'Stripe', '2018-01-01', '2020-01-01')])).toHaveLength(2))
  it('merges a gap of three months', () => expect(groupExperience([role('new', 'Stripe', '2020-05-01', null), role('old', 'Stripe', '2018-01-01', '2020-01-01')])).toHaveLength(1))
  it('handles year-only continuity', () => expect(groupExperience([role('new', 'A', '2022-01-01', null, { start_precision: 'year' }), role('old', 'A', '2019-01-01', '2021-01-01', { start_precision: 'year' })])).toHaveLength(1))
  it('handles single, empty, and current roles', () => { expect(groupExperience([])).toEqual([]); expect(groupExperience([role('only', 'A', '2024-01-01', null)])[0].current).toBe(true); expect(formatRoleDates(role('only', 'A', '2024-01-01', null))).toContain('Present') })
  it('normalizes legal suffixes', () => expect(companyKey(role('a', 'Stripe, Inc.', '2020-01-01', null))).toBe(companyKey(role('b', 'Stripe', '2019-01-01', null))))
  it('numbers three stints from earliest to latest and adds away text only to returns', () => {
    const groups = groupExperience([role('third', 'A', '2024-01-01', null), role('x2', 'C', '2023-01-01', '2023-12-01'), role('second', 'A', '2022-01-01', '2022-12-01'), role('x1', 'B', '2021-01-01', '2021-12-01'), role('first', 'A', '2019-01-01', '2020-12-01')]).filter((g) => g.company === 'A')
    expect(groups.map((g) => g.stint)).toEqual([3, 2, 1]); expect(groups.map((g) => g.returning)).toEqual([true, true, false]); expect(groups[0].awayText).toBeTruthy(); expect(groups[1].awayText).toBeTruthy(); expect(groups[2].awayText).toBeNull()
  })
  it('does not double-count overlapping employment', () => expect(unionExperienceMonths([role('a', 'A', '2020-01-01', '2020-12-01'), role('b', 'B', '2020-06-01', '2021-05-01')])).toBe(17))
  it('summarizes roles, distinct companies, and union years', () => expect(experienceSummary([role('a', 'Stripe, Inc.', '2020-01-01', '2020-12-01'), role('b', 'Stripe', '2021-01-01', '2021-12-01')])).toBe('2 roles · 1 company · 2 years total'))
})

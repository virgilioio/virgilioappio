import { describe, expect, it } from 'vitest'
import { offerFieldName } from '../offerFieldName'

const fits = (k: string) => /^[a-z][a-z_]{0,39}$/.test(k)

describe('offerFieldName', () => {
  it('makes names agreements can use', () => {
    expect(offerFieldName('Base Salary')).toBe('base_salary')
    expect(offerFieldName('Compensación variable')).toBe('compensacion_variable')
    expect(offerFieldName('Bonus 2026')).toBe('bonus')
    expect(offerFieldName("Candidate's full legal name")).toBe('candidate_s_full_legal_name')
    expect(offerFieldName('2026')).toBe('field')
    for (const l of ['Bonus 2026', 'A'.repeat(80), '¿Reubicación?', '12 months notice', 'x']) expect(fits(offerFieldName(l))).toBe(true)
  })

  it('never takes a standard agreement value', () => {
    expect(offerFieldName('Salary')).toBe('offer_salary')
    expect(offerFieldName('Start')).toBe('offer_start')
  })

  it('stays unique on the form', () => {
    expect(offerFieldName('Bonus 2026', ['bonus'])).toBe('bonus_b')
    expect(offerFieldName('Bonus 2027', ['bonus', 'bonus_b'])).toBe('bonus_c')
    expect(fits(offerFieldName('A'.repeat(80), ['a'.repeat(40)]))).toBe(true)
  })
})

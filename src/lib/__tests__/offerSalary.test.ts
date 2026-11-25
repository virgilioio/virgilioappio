import { describe, expect, it } from 'vitest'
import {
  baseSalaryField, offerBaseSalary, offerIsLive, readOfferSalary, salaryPerMonth, salaryPerYear,
  salaryWords, writeOfferSalary,
} from '../offerSalary'

const f = (field_name: string, display_order: number, field_config: unknown = null, field_type = 'salary') =>
  ({ field_name, field_type, field_config, display_order })

describe('the salary on an offer', () => {
  it('reads a stored value with its period, or starts from the form', () => {
    expect(readOfferSalary('{"amount":"40000","currency":"MXN","period":"monthly"}', { currency: 'USD', period: 'annually' }))
      .toEqual({ amount: '40000', currency: 'MXN', period: 'monthly' })
    // Saved before offers carried a period: the form's setting stands in.
    expect(readOfferSalary('{"amount":"40000","currency":"MXN"}', { currency: 'MXN', period: 'monthly' }).period).toBe('monthly')
    expect(readOfferSalary(null, { currency: 'MXN', period: 'monthly' })).toEqual({ amount: '', currency: 'MXN', period: 'monthly' })
    expect(readOfferSalary({ amount: 5000, currency: 'USD', period: 'yearly' }).period).toBe('annually')
    expect(readOfferSalary('120,000').amount).toBe('120000')
  })

  it('saves JSON text with all three parts', () => {
    expect(JSON.parse(writeOfferSalary({ amount: '40000', currency: 'MXN', period: 'monthly' })))
      .toEqual({ amount: '40000', currency: 'MXN', period: 'monthly' })
  })

  it('picks the base salary field as the database does', () => {
    const fields = [f('variable_compensation', 1), f('base_salary', 2), f('ote', 3), f('title', 0, null, 'text')]
    expect(baseSalaryField(fields)?.field_name).toBe('base_salary')
    expect(baseSalaryField([f('variable', 1), f('fixed', 2, { base: true })])?.field_name).toBe('fixed')
    expect(baseSalaryField([f('pay_b', 2), f('pay_a', 1)])?.field_name).toBe('pay_a')
    expect(baseSalaryField([f('title', 0, null, 'text')])).toBeNull()
  })

  it('reads the offer’s base salary', () => {
    const fields = [f('base_salary', 1, { currency: 'MXN', period: 'monthly' }), f('ote', 2)]
    expect(offerBaseSalary(fields, { base_salary: '{"amount":"40000","currency":"MXN","period":"monthly"}', ote: '{"amount":"900000"}' }))
      .toEqual({ amount: 40000, currency: 'MXN', period: 'monthly' })
    expect(offerBaseSalary(fields, { ote: '{"amount":"900000"}' })).toBeNull()
    expect(offerBaseSalary(fields, { base_salary: '{"amount":"","currency":"MXN"}' })).toBeNull()
    expect(offerBaseSalary(fields, undefined)).toBeNull()
  })

  it('turns a salary into a year and a month', () => {
    expect(salaryPerYear(40000, 'monthly')).toBe(480000)
    expect(salaryPerYear(135000, 'annually')).toBe(135000)
    expect(salaryPerMonth(480000, 'annually')).toBe(40000)
    expect(salaryWords({ amount: 40000, currency: 'MXN', period: 'monthly' })).toBe('MXN 40,000 per month')
  })

  it('knows which offers can carry a hire', () => {
    expect(['draft', 'approved', 'sent', 'accepted'].every(offerIsLive)).toBe(true)
    expect(['declined', 'withdrawn', 'expired'].some(offerIsLive)).toBe(false)
  })
})

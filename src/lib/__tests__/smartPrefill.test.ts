import { describe, expect, it } from 'vitest'
import { salaryFor, smartPrefill, toPeriod } from '../smartPrefill'

// 1 USD = 18 MXN, for these tests.
const convert = (amount: number, from: string, to: string) => {
  if (from === to) return amount
  if (from === 'MXN' && to === 'USD') return amount / 18
  if (from === 'USD' && to === 'MXN') return amount * 18
  return null
}

describe('toPeriod', () => {
  it('moves a salary between periods', () => {
    expect(toPeriod(10000, 'monthly', 'annually')).toBe(120000)
    expect(toPeriod(120000, 'annually', 'monthly')).toBe(10000)
    expect(toPeriod(50, 'hourly', 'annually')).toBeCloseTo(104000)
    expect(toPeriod(5, 'fortnightly', 'fortnightly')).toBe(5)
    expect(toPeriod(5, 'fortnightly', 'monthly')).toBeNull()
  })
})

describe('salaryFor', () => {
  const q = { id: 'q', answer_type: 'salary_expectations', salary_config: { currency: 'USD', period: 'annually' } }
  it('uses the question\'s own currency and period', () => {
    expect(salaryFor({ salary_amount: 90000, salary_currency: 'MXN', salary_period: 'monthly' }, q, convert)).toBe(60000)
    expect(salaryFor({ salary_amount: '150000', salary_currency: 'USD', salary_period: 'annually' }, q, convert)).toBe(150000)
  })
  it('takes the question\'s currency and period when the profile has none', () => {
    expect(salaryFor({ salary_amount: 150000 }, q, convert)).toBe(150000)
  })
  it('gives nothing it can\'t convert or nothing at all', () => {
    expect(salaryFor({ salary_amount: 1000, salary_currency: 'EUR' }, q, convert)).toBeNull()
    expect(salaryFor({ salary_amount: 0 }, q, convert)).toBeNull()
    expect(salaryFor({ salary_amount: null }, q, convert)).toBeNull()
  })
})

describe('smartPrefill', () => {
  const qs = [
    { id: 's', answer_type: 'salary_expectations', salary_config: { currency: 'MXN', period: 'monthly' } },
    { id: 'p', answer_type: 'phone' },
    { id: 'l', answer_type: 'linkedin' },
    { id: 'x', answer_type: 'location' },
    { id: 't', answer_type: 'text' },
  ]
  const candidate = {
    salary_amount: 120000, salary_currency: 'USD', salary_period: 'annually',
    phone: '+52 55 1234 5678', linkedin_url: 'https://linkedin.com/in/jordan-rivera',
    location_city: 'Guadalajara', location_state: 'Jalisco', location_country: 'Mexico',
  }
  it('fills every smart question with no answer, and nothing else', () => {
    expect(smartPrefill(qs, () => false, candidate, convert)).toEqual({
      s: '180000',
      p: '+52 55 1234 5678',
      l: 'https://linkedin.com/in/jordan-rivera',
      x: 'Guadalajara, Jalisco, Mexico',
    })
  })
  it('never touches an answered question', () => {
    expect(smartPrefill(qs, (id) => id === 's' || id === 'p', candidate, convert)).toEqual({
      l: 'https://linkedin.com/in/jordan-rivera',
      x: 'Guadalajara, Jalisco, Mexico',
    })
  })
  it('leaves out what the profile doesn\'t have', () => {
    expect(smartPrefill(qs, () => false, { location_country: 'Mexico' }, convert)).toEqual({ x: 'Mexico' })
    expect(smartPrefill(qs, () => false, null, convert)).toEqual({})
  })
})

import { describe, expect, it } from 'vitest'
import { bandPeriodOf, normaliseSalary, type RateMap } from '../salary'
import { jobCriteria, payBand } from '../interviewNotesFormat'

const rates: RateMap = new Map([['USD:MXN', 18.5], ['MXN:USD', 1 / 18.5], ['USD:CAD', 1.39], ['CAD:USD', 1 / 1.39]])

describe('the pay period of a job\'s salary range', () => {
  it('uses the job\'s own period when it is set', () => {
    expect(bandPeriodOf({ salary_max: 40000, salary_period: 'annual', currency: 'MXN' }, rates)).toEqual({ period: 'annually', source: 'job' })
    expect(bandPeriodOf({ salary_max: 900000, salary_period: 'monthly', currency: 'MXN' }, rates)).toEqual({ period: 'monthly', source: 'job' })
  })

  it('reads a range saved without a period from its size', () => {
    // MXN 25,000-40,000 is about USD 2,200: a monthly range.
    expect(bandPeriodOf({ salary_min: 25000, salary_max: 40000, currency: 'MXN' }, rates)).toEqual({ period: 'monthly', source: 'size' })
    // MXN 1,500,000 is about USD 81,000: yearly.
    expect(bandPeriodOf({ salary_max: 1500000, currency: 'MXN' }, rates).period).toBe('annually')
    expect(bandPeriodOf({ salary_min: 60000, salary_max: 84000, currency: 'USD' }, rates).period).toBe('annually')
    expect(bandPeriodOf({ salary_max: 4500, currency: 'USD' }, rates).period).toBe('monthly')
  })

  it('falls back to rough values without today\'s rates, and to yearly for an unknown currency', () => {
    expect(bandPeriodOf({ salary_max: 40000, currency: 'MXN' }).period).toBe('monthly')
    expect(bandPeriodOf({ salary_max: 40000, currency: 'XYZ' })).toEqual({ period: 'annually', source: 'default' })
    expect(bandPeriodOf({ salary_period: null, currency: 'MXN' })).toEqual({ period: 'annually', source: 'default' })
  })

  it('puts a monthly expectation on the same basis as a monthly MXN range', () => {
    const period = bandPeriodOf({ salary_min: 35000, salary_max: 45000, currency: 'MXN' }, rates).period
    const onBand = normaliseSalary(42000, 'MXN', 'monthly', 'MXN', period, rates)
    expect(onBand?.amount).toBe(42000)
    expect(onBand?.converted).toBe(false)
  })

  it('reads interview-note requirements the same way', () => {
    const job = { salary_min: 35000, salary_max: 45000, currency: 'MXN', salary_period: null }
    expect(payBand(job, rates)?.period).toBe('monthly')
    expect(jobCriteria(job, rates).find((c) => c.kind === 'salary')?.label).toBe('Salary within MXN 35,000-45,000 a month')
  })
})

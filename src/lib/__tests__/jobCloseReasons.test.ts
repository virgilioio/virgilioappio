import { describe, expect, it } from 'vitest'
import { closeReasonProblem, jobCloseReasonLabel, jobCloseReasonText, JOB_CLOSE_REASONS } from '../jobCloseReasons'

describe('job close reasons', () => {
  it('offers every reason but Not recorded, in the database words', () => {
    expect(JOB_CLOSE_REASONS.map((r) => r.key)).toEqual([
      'filled', 'client_cancelled', 'on_hold', 'filled_elsewhere', 'role_changed', 'duplicate', 'other',
    ])
    expect(jobCloseReasonLabel('role_changed')).toBe('Budget or role changed')
    expect(jobCloseReasonLabel('not_recorded')).toBe('Not recorded')
    expect(jobCloseReasonLabel('nope')).toBeNull()
  })

  it('reads a reason with its note', () => {
    expect(jobCloseReasonText('filled', null)).toBe('Filled')
    expect(jobCloseReasonText('on_hold', 'Back in March')).toBe('On hold · Back in March')
    expect(jobCloseReasonText('other', 'Merged into another search')).toBe('Merged into another search')
    expect(jobCloseReasonText(null, 'x')).toBeNull()
  })

  it('needs a reason, and a note for Other', () => {
    expect(closeReasonProblem(null, '')).toMatch(/Pick/)
    expect(closeReasonProblem('other', '  ')).toMatch(/Say why/)
    expect(closeReasonProblem('other', 'Merged')).toBeNull()
    expect(closeReasonProblem('filled', '')).toBeNull()
  })
})

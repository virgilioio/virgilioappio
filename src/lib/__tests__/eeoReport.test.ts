import { describe, expect, it } from 'vitest'
import { answerRows, cellText, eeoCsvRows, eeoPeriodRange, share, type EeoReport } from '@/lib/eeoReport'

const report: EeoReport = {
  applicants: 67,
  answered_any: 3,
  declined_all: 1,
  not_answered: 63,
  min_group: 5,
  questions: {
    gender: [
      { answer: 'male', applicants: null, past_review: null, offer: 0, hired: 0 },
      { answer: 'not_answered', applicants: 63, past_review: 42, offer: null, hired: null },
    ],
  },
}

describe('self-identification report', () => {
  it('lists every option in the form order, unchosen ones at 0, Didn\'t answer last', () => {
    const rows = answerRows('gender', report)
    expect(rows.map((r) => r.answer)).toEqual(['male', 'female', 'non_binary', 'other', 'decline', 'not_answered'])
    expect(rows[1]).toMatchObject({ applicants: 0, past_review: 0 })
    expect(rows[5].label).toBe("Didn't answer")
    expect(answerRows('disability_status', undefined)).toHaveLength(4)
  })

  it('shows hidden small groups as fewer than 5 and gives no share for them', () => {
    expect(cellText(null)).toBe('Fewer than 5')
    expect(cellText(1234)).toBe('1,234')
    expect(share(null, 67)).toBeNull()
    expect(share(63, 67)).toBe(94)
    expect(share(0, 0)).toBeNull()
  })

  it('writes totals only to the CSV, one line per answer', () => {
    const { header, rows } = eeoCsvRows(report)
    expect(header[0]).toBe('Question')
    expect(rows).toHaveLength(6 + 9 + 5 + 4)
    expect(rows[0]).toEqual(['Gender', 'Male', 'Fewer than 5', '', 'Fewer than 5', '0', '0'])
    expect(rows[5]).toEqual(['Gender', "Didn't answer", '63', 94, '42', 'Fewer than 5', 'Fewer than 5'])
  })

  it('works out the periods', () => {
    const today = new Date(2026, 10, 4)
    expect(eeoPeriodRange('year', today)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
    expect(eeoPeriodRange('quarter', today)).toEqual({ from: '2026-10-01', to: '2026-12-31' })
    expect(eeoPeriodRange('12m', today)).toEqual({ from: '2025-11-05', to: '2026-11-04' })
    expect(eeoPeriodRange('all', today)).toBeNull()
  })
})

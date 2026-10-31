import { describe, expect, it } from 'vitest'
import { commissionTotals, periodRange, type Earning } from '@/lib/os/earnings'

const today = new Date(2026, 9, 31) // Oct 31, 2026

const e = (over: Partial<Earning>): Earning => ({
  id: Math.random().toString(36),
  source: 'invoice',
  request_number: null,
  invoice_number: null,
  client_name: null,
  deal_title: null,
  opening_id: null,
  job_id: null,
  role_key: 'tap',
  role_label: 'Recruiter',
  share_pct: 100,
  basis: 'percent',
  currency: 'USD',
  invoice_amount: null,
  collected_amount: 0,
  earned_amount: 0,
  pending_amount: 0,
  status: 'issued',
  void_reason: null,
  issued_on: null,
  paid_on: null,
  partner_name: null,
  item_name: null,
  earned_on: null,
  ...over,
})

const ROWS: Earning[] = [
  e({ status: 'paid', earned_amount: 500, issued_on: '2026-09-20', paid_on: '2026-10-05' }),
  e({ status: 'paid', earned_amount: 300, currency: 'MXN', issued_on: '2026-02-01', paid_on: '2026-02-20' }),
  e({ status: 'paid', earned_amount: 900, issued_on: '2025-11-01', paid_on: '2025-12-01' }),
  e({ source: 'lead', status: 'earned', earned_amount: 100, earned_on: '2026-10-12' }),
  e({ status: 'issued', pending_amount: 250, issued_on: '2026-10-20' }),
  e({ status: 'partly_paid', earned_amount: 50, pending_amount: 50, issued_on: '2026-08-02' }),
  e({ status: 'void', earned_amount: 999, pending_amount: 999, issued_on: '2026-10-01', paid_on: '2026-10-02' }),
]

const SEATS = [
  { status: 'open' as const, target_hire_date: '2026-11-15', estimate: { amount: 2000, currency: 'USD', rate: 20 } },
  { status: 'offer' as const, target_hire_date: '2026-10-25', estimate: { amount: 40000, currency: 'MXN', rate: 20 } },
  { status: 'open' as const, target_hire_date: null, estimate: { missing: 'No fee set' } },
  { status: 'filled' as const, target_hire_date: '2026-10-10', estimate: undefined },
]

describe('periods', () => {
  it('are calendar month, quarter and year around today', () => {
    expect(periodRange('month', today)).toEqual({ from: '2026-10-01', to: '2026-10-31' })
    expect(periodRange('quarter', today)).toEqual({ from: '2026-10-01', to: '2026-12-31' })
    expect(periodRange('year', today)).toEqual({ from: '2026-01-01', to: '2026-12-31' })
    expect(periodRange('all', today)).toBeNull()
    expect(periodRange('quarter', new Date(2026, 1, 28))).toEqual({ from: '2026-01-01', to: '2026-03-31' })
  })
})

describe('commission totals', () => {
  it('paid counts what was paid or accepted in the period, never a void', () => {
    const month = commissionTotals('paid', 'month', ROWS, SEATS, today)
    expect(month.sums).toEqual([{ currency: 'USD', amount: 600 }])
    expect([month.invoices, month.leads]).toEqual([1, 1])
    const year = commissionTotals('paid', 'year', ROWS, SEATS, today)
    // A partly paid invoice counts its paid part by its issue day when it has no paid day yet.
    expect(year.sums).toEqual([{ currency: 'USD', amount: 650 }, { currency: 'MXN', amount: 300 }])
    expect(commissionTotals('paid', 'all', ROWS, SEATS, today).sums[0]).toEqual({ currency: 'USD', amount: 1550 })
  })

  it('pending counts invoices issued in the period and not yet paid', () => {
    expect(commissionTotals('pending', 'month', ROWS, SEATS, today).sums).toEqual([{ currency: 'USD', amount: 250 }])
    expect(commissionTotals('pending', 'year', ROWS, SEATS, today).sums).toEqual([{ currency: 'USD', amount: 300 }])
  })

  it('potential counts open seats by target hire date; all time takes undated ones too', () => {
    const month = commissionTotals('potential', 'month', ROWS, SEATS, today)
    expect(month.sums).toEqual([{ currency: 'MXN', amount: 40000 }])
    expect(month.seats).toBe(1)
    const quarter = commissionTotals('potential', 'quarter', ROWS, SEATS, today)
    expect(quarter.sums).toEqual([{ currency: 'USD', amount: 2000 }, { currency: 'MXN', amount: 40000 }])
    const all = commissionTotals('potential', 'all', ROWS, SEATS, today)
    expect([all.seats, all.unestimated]).toEqual([3, 1])
  })

  it('nothing in the period is an empty list, not an error', () => {
    expect(commissionTotals('paid', 'month', [], [], today)).toEqual({ sums: [], invoices: 0, leads: 0, seats: 0, unestimated: 0 })
  })
})

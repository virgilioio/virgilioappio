import { describe, expect, it } from 'vitest'
import { commissionTotals, periodRange, type CommissionLineStatus, type Earning } from '@/lib/os/earnings'

const today = new Date(2026, 9, 31) // Oct 31, 2026

let n = 0
const e = (over: Partial<Earning>): Earning => ({
  id: `e${++n}`,
  sales_credit_id: `c${n}`,
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

// Client paid Oct 5: payable. Client paid in February and Virgilio paid it out: paid (not payable).
const payableOct = e({ status: 'paid', earned_amount: 500, issued_on: '2026-09-20', paid_on: '2026-10-05' })
const paidOut = e({ status: 'paid', earned_amount: 300, currency: 'MXN', issued_on: '2026-02-01', paid_on: '2026-02-20' })
const inPayout = e({ status: 'paid', earned_amount: 900, issued_on: '2026-07-01', paid_on: '2026-08-01' })
const lead = e({ source: 'lead', status: 'earned', earned_amount: 100, earned_on: '2026-10-12' })
const invoiced = e({ status: 'issued', pending_amount: 250, issued_on: '2026-10-20' })
const partly = e({ status: 'partly_paid', earned_amount: 50, pending_amount: 50, issued_on: '2026-08-02' })
const voided = e({ status: 'void', earned_amount: 999, pending_amount: 999, issued_on: '2026-10-01', paid_on: '2026-10-02' })
const rows = [payableOct, paidOut, inPayout, lead, invoiced, partly, voided]

const statusOf = (x: Earning): CommissionLineStatus =>
  x === voided ? 'void' : x === paidOut ? 'paid' : x === inPayout ? 'in_payout' : x.status === 'paid' || x.status === 'earned' ? 'payable' : 'pending'

const payouts = [
  { status: 'paid' as const, total: 4200, currency: 'MXN', paid_on: '2026-03-05' },
  { status: 'paid' as const, total: 1500, currency: 'USD', paid_on: '2026-10-15' },
  { status: 'approved' as const, total: 900, currency: 'USD', paid_on: null },
]

const seats = [
  { status: 'open' as const, target_hire_date: '2026-11-15', estimate: { amount: 2000, currency: 'USD', rate: 20 } },
  { status: 'offer' as const, target_hire_date: '2026-10-25', estimate: { amount: 40000, currency: 'MXN', rate: 20 } },
  { status: 'open' as const, target_hire_date: null, estimate: { missing: 'No fee set' } },
  { status: 'filled' as const, target_hire_date: '2026-10-10', estimate: undefined },
]
const input = { rows, statusOf, payouts, seats }

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
  it('paid is only what Virgilio paid out, by the day paid', () => {
    const month = commissionTotals('paid', 'month', input, today)
    expect(month.sums).toEqual([{ currency: 'USD', amount: 1500 }])
    expect(month.payouts).toBe(1)
    expect(commissionTotals('paid', 'year', input, today).sums).toEqual([
      { currency: 'USD', amount: 1500 },
      { currency: 'MXN', amount: 4200 },
    ])
  })

  it('payable is ready to pay or in an approved payout, never paid out or void', () => {
    const month = commissionTotals('payable', 'month', input, today)
    expect(month.sums).toEqual([{ currency: 'USD', amount: 600 }])
    const year = commissionTotals('payable', 'year', input, today)
    expect(year.sums).toEqual([{ currency: 'USD', amount: 1500 }])
    expect([year.lines, year.inPayout]).toEqual([3, 1])
  })

  it('pending is what clients have not paid in full, by the issue day', () => {
    expect(commissionTotals('pending', 'month', input, today).sums).toEqual([{ currency: 'USD', amount: 250 }])
    const year = commissionTotals('pending', 'year', input, today)
    expect(year.sums).toEqual([{ currency: 'USD', amount: 350 }])
    expect(year.lines).toBe(2)
  })

  it('potential counts open seats by target hire date; all time takes undated ones too', () => {
    const month = commissionTotals('potential', 'month', input, today)
    expect(month.sums).toEqual([{ currency: 'MXN', amount: 40000 }])
    const quarter = commissionTotals('potential', 'quarter', input, today)
    expect(quarter.sums).toEqual([{ currency: 'USD', amount: 2000 }, { currency: 'MXN', amount: 40000 }])
    const all = commissionTotals('potential', 'all', input, today)
    expect([all.seats, all.unestimated]).toEqual([3, 1])
  })

  it('nothing in the period is an empty list, not an error', () => {
    const empty = { rows: [], statusOf, payouts: [], seats: [] }
    expect(commissionTotals('paid', 'month', empty, today)).toEqual({ sums: [], payouts: 0, lines: 0, inPayout: 0, seats: 0, unestimated: 0 })
  })
})

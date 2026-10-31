import type { KeyboardEvent } from 'react'
import type { LucideIcon } from 'lucide-react'

import type { MetricItem, MetricTone } from '@/components/ui/metric-strip'
import { money } from '@/lib/os/earnings'

/** Shared pieces of the Earnings views (commissions phase 3, 2026-10-31). */

export type PeriodFilter = 'all' | 'year' | 'quarter' | 'd90'
export const PERIOD_LABEL: Record<PeriodFilter, string> = { all: 'All time', year: 'This year', quarter: 'This quarter', d90: 'Last 90 days' }
export const PERIODS: PeriodFilter[] = ['all', 'year', 'quarter', 'd90']

/** Today in Mexico City's calendar ("2026-10-31"), where Virgilio's days are counted. */
export const todayMx = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })

/** The first day a period starts on ("2026-01-01"), in Mexico City's calendar; null for all time. */
export function periodFrom(p: PeriodFilter) {
  if (p === 'all') return null
  const today = todayMx()
  const [y, m] = today.split('-').map(Number)
  if (p === 'year') return `${y}-01-01`
  if (p === 'quarter') return `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, '0')}-01`
  const d = new Date(`${today}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 90)
  return d.toISOString().slice(0, 10)
}

export function day(iso: string | null | undefined) {
  if (!iso) return null
  // A plain date is that day wherever you are, not midnight UTC.
  const at = iso.length === 10 ? new Date(`${iso}T12:00:00Z`) : new Date(iso)
  return at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', ...(iso.length === 10 ? { timeZone: 'UTC' } : {}) })
}

export function Money({ amount, currency, muted, signed }: { amount: number; currency: string; muted?: boolean; signed?: boolean }) {
  const m = money(Math.abs(amount), currency)
  const sign = signed ? (amount < 0 ? '−' : amount > 0 ? '+' : '') : amount < 0 ? '−' : ''
  return (
    <span title={m.title} className={muted ? 'tabular-nums text-[#8B8F9E]' : 'tabular-nums'}>
      {sign}
      {m.text}
    </span>
  )
}

export function Dot({ label, dot }: { label: string; dot: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} aria-hidden />
      {label}
    </span>
  )
}

/** A strip cell: the first currency counts up once per session, any other currency sits under it. */
export function moneyMetric(label: string, icon: LucideIcon, tone: MetricTone, sums: { amount: number; currency: string }[]): MetricItem {
  const [first, ...rest] = sums.length ? sums : [{ amount: 0, currency: 'USD' }]
  return {
    label,
    icon,
    tone,
    value: first.amount,
    format: (v) => money(v, first.currency).text,
    detail: rest.length ? rest.map((s) => `+ ${money(s.amount, s.currency).text}`).join(' · ') : undefined,
  }
}

export const PAYOUT_STATUS = {
  approved: { label: 'Approved', dot: '#0EA5E9' },
  paid: { label: 'Paid', dot: '#0F9F74' },
} as const

/** A payout's state in a line: "Due Nov 5, 2026" or "Paid Oct 31, 2026". */
export function payoutWhen(p: { status: 'approved' | 'paid'; paid_on: string | null; invoice_due_on: string | null; approved_on: string | null }) {
  if (p.status === 'paid') return p.paid_on ? `Paid ${day(p.paid_on)}` : 'Paid'
  if (p.invoice_due_on) return `Due ${day(p.invoice_due_on)}`
  return p.approved_on ? `Approved ${day(p.approved_on)}` : 'Approved'
}

/** A row that opens something: the whole row is the button, the keyboard included. */
export function rowButtonProps(onOpen: () => void, label: string) {
  return {
    role: 'button' as const,
    tabIndex: 0,
    'aria-label': label,
    onClick: onOpen,
    onKeyDown: (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        onOpen()
      }
    },
    className: 'cursor-pointer',
  }
}

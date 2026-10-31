import { useState } from 'react'
import { Coins, Eye, EyeOff } from 'lucide-react'
import { BlendNumber } from '@/components/ui/blend-number'
import { IconSwap } from '@/components/ui/icon-swap'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SegmentLayer, useSegmentLayer } from '@/components/ui/segmented'
import { Skeleton } from '@/components/ui/skeleton'
import { IconTip } from '@/components/ui/tooltip'
import { LoadError } from '@/components/empty/LoadError'
import { ProfileCard } from '@/components/os/ProfileParts'
import { useEarningsSummary } from '@/components/os/PersonEarnings'
import type { PersonJob } from '@/lib/os/peopleAccess'
import {
  commissionTotals,
  money,
  type CommissionPeriod,
  type CommissionTotals,
  type CommissionView,
} from '@/lib/os/earnings'

/**
 * My profile's Balance card (2026-10-31; "Balance" so it can hold more than
 * commissions later): Paid · Payable · Pending · Potential over a period, each
 * amount with its currency code beside it, and the eye to hide the amounts
 * (kept per browser, hidden until shown). The Earnings tab's numbers and
 * statuses (paid comes from payouts, never from a client's payment); View all
 * opens it.
 */
const VIEWS: { id: CommissionView; label: string }[] = [
  { id: 'paid', label: 'Paid' },
  { id: 'payable', label: 'Payable' },
  { id: 'pending', label: 'Pending' },
  { id: 'potential', label: 'Potential' },
]
const PERIODS: { id: CommissionPeriod; label: string }[] = [
  { id: 'month', label: 'This month' },
  { id: 'quarter', label: 'This quarter' },
  { id: 'year', label: 'This year' },
  { id: 'all', label: 'All time' },
]
const HIDE_KEY = 'gio:commissions-hidden'
const MASK = '•••••'

/** The amount without a currency code (the card shows the code on its own, beside it). */
function amountOnly(amount: number, currency: string) {
  const text = money(amount, currency).text
  return text.endsWith(` ${currency}`) ? text.slice(0, -currency.length - 1) : text
}

function readHidden() {
  try {
    return localStorage.getItem(HIDE_KEY) !== 'shown'
  } catch {
    return true
  }
}

function writeHidden(hidden: boolean) {
  try {
    localStorage.setItem(HIDE_KEY, hidden ? 'hidden' : 'shown')
  } catch {
    // no storage: the choice lasts for this visit
  }
}

function sourceLine(view: CommissionView, t: CommissionTotals) {
  const n = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
  if (view === 'potential') {
    if (!t.seats) return 'No open seats in this period'
    const missing = t.unestimated ? ` · ${n(t.unestimated, 'has', 'have')} no estimate yet` : ''
    return `From ${n(t.seats, 'open seat', 'open seats')}${missing}`
  }
  if (view === 'paid') return t.payouts ? `From ${n(t.payouts, 'payout', 'payouts')}` : 'Nothing paid in this period'
  if (view === 'payable') {
    if (!t.lines) return 'Nothing payable in this period'
    return `From ${n(t.lines, 'commission', 'commissions')}${t.inPayout ? ` · ${t.inPayout} already in a payout` : ''}`
  }
  return t.lines ? `From ${n(t.lines, 'invoice', 'invoices')} the client hasn't paid in full` : 'Nothing pending in this period'
}

export function CommissionsCard({
  userId,
  tenantId,
  jobs,
  jobsLoading,
  onSeeAll,
}: {
  userId: string
  tenantId: string | undefined
  jobs: PersonJob[]
  jobsLoading: boolean
  onSeeAll: () => void
}) {
  const [view, setView] = useState<CommissionView>('paid')
  const [period, setPeriod] = useState<CommissionPeriod>('year')
  const [hidden, setHidden] = useState(readHidden)
  const segRef = useSegmentLayer<HTMLDivElement>()
  const summary = useEarningsSummary(userId, tenantId, jobs, jobsLoading)

  const loading =
    view === 'potential'
      ? summary.jobsLoading || summary.openings.isLoading || summary.rates.isLoading
      : summary.payouts.isLoading || (view !== 'paid' && summary.earnings.isLoading)
  const failed =
    view === 'potential'
      ? summary.openings.isError || summary.rates.isError
      : summary.payouts.isError || (view !== 'paid' && summary.earnings.isError)
  const seats = summary.list.map((o) => ({ status: o.status, target_hire_date: o.target_hire_date, estimate: summary.estimates.get(o.id) }))
  const totals = commissionTotals(
    view,
    period,
    { rows: summary.rows, statusOf: summary.statusOf, payouts: summary.payouts.data ?? [], seats },
    new Date(),
  )
  const [first, ...rest] = totals.sums.length ? totals.sums : [{ amount: 0, currency: 'USD' }]

  const toggle = () => {
    setHidden((h) => {
      writeHidden(!h)
      return !h
    })
  }

  return (
    <ProfileCard
      id="card-commissions"
      title="Balance"
      icon={Coins}
      tone="green"
      aside={
        <div className="flex shrink-0 items-center gap-1">
          <IconTip label={hidden ? 'Show amounts' : 'Hide amounts'}>
            <button
              type="button"
              onClick={toggle}
              aria-label={hidden ? 'Show amounts' : 'Hide amounts'}
              aria-pressed={!hidden}
              className="gio-pressable inline-flex h-8 w-8 items-center justify-center rounded-[8px] text-[#5A6072] transition-colors duration-hover hover:bg-[#F1F0EC] hover:text-[#1F2230]"
            >
              <IconSwap swapped={!hidden} from={<Eye size={15} strokeWidth={2} />} to={<EyeOff size={15} strokeWidth={2} />} />
            </button>
          </IconTip>
          <button
            type="button"
            onClick={onSeeAll}
            className="gio-pressable h-8 whitespace-nowrap rounded-[8px] border border-[#E7E8EE] bg-white px-3 font-inter text-[12.5px] font-medium text-[#1F2230] transition-colors duration-hover hover:bg-[#F7F6F2]"
          >
            View all
          </button>
        </div>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div ref={segRef} className="gio-seg inline-flex rounded-[9px] bg-[#ECEAE2] p-[3px]" role="radiogroup" aria-label="Commissions to show">
          {VIEWS.map((v) => {
            const active = v.id === view
            return (
              <button
                key={v.id}
                type="button"
                role="radio"
                aria-checked={active}
                data-seg-option
                data-active={active || undefined}
                onClick={() => setView(v.id)}
                className="rounded-[7px] px-3 py-[6px] font-inter text-[12.5px] font-medium transition-colors duration-hover"
                style={{ color: active ? '#1F2230' : '#5A6072' }}
              >
                {v.label}
              </button>
            )
          })}
          <SegmentLayer fill="#FFFFFF" shadow="0 1px 2px rgba(13,13,9,.08)" />
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as CommissionPeriod)}>
          <SelectTrigger aria-label="Period" className="h-8 w-auto min-w-[132px] gap-2 text-[12.5px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIODS.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="mt-4 min-h-[76px]">
        {failed ? (
          <LoadError
            what="your commissions"
            compact
            onRetry={() => {
              void summary.earnings.refetch()
              void summary.payouts.refetch()
              void summary.openings.refetch()
              void summary.rates.refetch()
            }}
          />
        ) : loading ? (
          <div aria-hidden>
            <Skeleton className="h-[38px] w-[180px]" />
            <Skeleton className="mt-3 h-[14px] w-[220px]" />
          </div>
        ) : (
          <>
            <p className="font-poppins text-[32px] font-semibold leading-[1.15] tracking-[-0.03em] text-[#1F2230] tabular-nums">
              {hidden ? (
                <span aria-label="Amount hidden">{MASK}</span>
              ) : (
                <BlendNumber
                  id={`my-commissions-${userId}`}
                  value={first.amount}
                  format={(v) => amountOnly(v, first.currency)}
                  title={money(first.amount, first.currency).title}
                />
              )}
              <span className="ml-1.5 font-inter text-[15px] font-medium tracking-normal text-[#6B7080]">{first.currency}</span>
            </p>
            {rest.length > 0 && (
              <p className="mt-0.5 font-inter text-[12.5px] text-[#5A6072] tabular-nums">
                {rest.map((s) => `+ ${hidden ? MASK : amountOnly(s.amount, s.currency)} ${s.currency}`).join(' · ')}
              </p>
            )}
            <p className="mt-1.5 font-inter text-[12px] text-[#6B7080]">{sourceLine(view, totals)}</p>
          </>
        )}
      </div>
    </ProfileCard>
  )
}

import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CircleDollarSign, Clock, Coins, ListChecks, ReceiptText, Search, Send, TrendingUp, Wallet } from 'lucide-react'

import { FilterChipSelect } from '@/components/ui/filter-chip-select'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { MetricStrip } from '@/components/ui/metric-strip'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { LoadError } from '@/components/empty/LoadError'
import { JobPreview } from '@/components/previews/EntityPreview'
import { ProfileCard } from '@/components/os/ProfileParts'
import {
  AdjustmentsView,
  InvoiceViewer,
  InvoicesView,
  NextPayoutCard,
  PayoutSheet,
  PayoutsView,
  RecentPayments,
  useInvoiceActions,
} from '@/components/os/earnings/PayoutViews'
import { Dot, Money, PERIOD_LABEL, PERIODS, day, moneyMetric, periodFrom, type PeriodFilter } from '@/components/os/earnings/parts'
import { maskedAccount, useBankDetails } from '@/lib/os/bank'
import { rateFor, useCommissionRates } from '@/lib/os/commissions'
import { byCurrency, estimateOpening, money, usePersonEarnings, usePersonOpenings, type Earning, type PersonOpening } from '@/lib/os/earnings'
import type { PersonJob } from '@/lib/os/peopleAccess'
import { inPayoutIds, inPayoutTotals, monthName, usePersonAdjustments, usePersonPayouts, type PersonPayout } from '@/lib/os/payouts'

const SEAT_LABEL = { sp: 'Sourcer', tap: 'Recruiter' } as const

const OPENING_STATUS = {
  offer: { label: 'In offer', dot: '#F59E0B' },
  open: { label: 'Open', dot: '#0EA5E9' },
  filled: { label: 'Filled', dot: '#12B886' },
} as const
const OPENING_ORDER = { offer: 0, open: 1, filled: 2 } as const

// The commission's status, not the client's invoice (Allan, 2026-10-31): it's
// payable once the client has paid in full (or a partner accepted the lead), in
// a payout once Billing approves one that names it, and earned only when
// Virgilio pays it out.
const INVOICE_STATUS: Record<Earning['status'], { label: string; dot: string }> = {
  issued: { label: 'Pending · invoiced', dot: '#0EA5E9' },
  partly_paid: { label: 'Pending · client partly paid', dot: '#F59E0B' },
  paid: { label: 'Payable', dot: '#12B886' },
  void: { label: 'Void', dot: '#9CA3AF' },
  earned: { label: 'Payable', dot: '#12B886' },
}
const IN_PAYOUT = { label: 'In a payout', dot: '#8456F6' }
const PAID_OUT = { label: 'Paid', dot: '#0F9F74' }

/** Can be paid: the client paid the invoice in full, or a partner accepted the lead. */
const isPayable = (e: Earning) => e.status === 'paid' || e.status === 'earned'
/** What waits on the client: the whole commission until its invoice is paid in full. */
const pendingOf = (e: Earning) => (e.status === 'issued' || e.status === 'partly_paid' ? e.earned_amount + e.pending_amount : 0)

type LineStatus = 'pending' | 'payable' | 'in_payout' | 'paid' | 'void'

export type EarningsView = 'overview' | 'commissions' | 'payouts' | 'invoices' | 'adjustments'
const VIEWS: EarningsView[] = ['overview', 'commissions', 'payouts', 'invoices', 'adjustments']
const VIEW_LABEL: Record<EarningsView, string> = {
  overview: 'Overview',
  commissions: 'Commissions',
  payouts: 'Payouts',
  invoices: 'Invoices',
  adjustments: 'Adjustments',
}

/**
 * Every figure the Earnings views share, worked out once from the payouts, the
 * commissions, the openings and today's rates. Paid is what Virgilio paid out
 * (earned); In a payout is what Billing approved and hasn't paid; Payable leaves
 * out both.
 */
export function useEarningsSummary(userId: string | null, tenantId: string | undefined, jobs: PersonJob[], jobsLoading: boolean) {
  const earnings = usePersonEarnings(userId)
  const payouts = usePersonPayouts(userId)
  const adjustments = usePersonAdjustments(userId)
  const openings = usePersonOpenings(userId, jobs, !jobsLoading)
  const rates = useCommissionRates(tenantId)

  const all = payouts.data ?? []
  const paidPayouts = all.filter((p) => p.status === 'paid')
  const paidIn = useMemo(() => {
    const m = new Map<string, PersonPayout>()
    for (const p of payouts.data ?? []) if (p.status === 'paid') for (const id of p.sales_credit_ids) m.set(id, p)
    return m
  }, [payouts.data])
  const approvedIn = useMemo(() => inPayoutIds(payouts.data ?? []), [payouts.data])
  const yearFrom = periodFrom('year')!
  const paidThisYear = byCurrency(paidPayouts.filter((p) => (p.paid_on ?? '') >= yearFrom).map((p) => ({ amount: p.total, currency: p.currency })))
  const inPayout = inPayoutTotals(all)

  const rows = earnings.data ?? []
  const live = rows.filter((e) => e.status !== 'void')
  const statusOf = (e: Earning): LineStatus =>
    e.status === 'void'
      ? 'void'
      : paidIn.has(e.sales_credit_id)
        ? 'paid'
        : approvedIn.has(e.sales_credit_id)
          ? 'in_payout'
          : isPayable(e)
            ? 'payable'
            : 'pending'
  const payable = byCurrency(live.filter((e) => statusOf(e) === 'payable').map((e) => ({ amount: e.earned_amount, currency: e.currency })))
  const pending = byCurrency(live.filter((e) => pendingOf(e) > 0).map((e) => ({ amount: pendingOf(e), currency: e.currency })))

  const list = (openings.data ?? [])
    .slice()
    .sort((a, b) => OPENING_ORDER[a.status] - OPENING_ORDER[b.status] || (b.filled_at ?? '').localeCompare(a.filled_at ?? ''))
  const estimates = new Map(list.filter((o) => o.status !== 'filled').map((o) => [o.id, estimateOpening(o, rates.data ?? [])]))
  const potential = byCurrency([...estimates.values()].flatMap((e) => ('amount' in e ? [{ amount: e.amount, currency: e.currency }] : [])))
  const unestimated = [...estimates.values()].filter((e) => 'missing' in e).length
  return {
    earnings,
    payouts,
    adjustments,
    openings,
    rates,
    rows,
    live,
    list,
    estimates,
    paidIn,
    approvedIn,
    statusOf,
    paidThisYear,
    inPayout,
    payable,
    pending,
    potential,
    unestimated,
    jobsLoading,
  }
}
type Summary = ReturnType<typeof useEarningsSummary>

/**
 * Earnings: each member's commission portal, after Deel's worker portal
 * (commissions phase 3, 2026-10-31). A tab bar (`?view=`) with Overview,
 * Commissions, Payouts, Invoices and Adjustments, the same on My profile and
 * for People & Access admins on a member's profile; `?payout=` opens a payout.
 * Read only: Billing works on payouts in Gio Sales.
 */
export function PersonEarnings({
  userId,
  tenantId,
  jobs,
  jobsLoading,
  self = false,
}: {
  userId: string | null
  tenantId: string | undefined
  jobs: PersonJob[]
  jobsLoading: boolean
  /** My profile: the copy speaks to the person ("you") instead of about them. */
  self?: boolean
}) {
  const summary = useEarningsSummary(userId, tenantId, jobs, jobsLoading)
  const actions = useInvoiceActions(self)
  const [params, setParams] = useSearchParams()
  const raw = params.get('view') ?? ''
  const view: EarningsView = (VIEWS as string[]).includes(raw) ? (raw as EarningsView) : 'overview'
  const payoutId = params.get('payout')
  const setView = (next: EarningsView) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (next === 'overview') p.delete('view')
        else p.set('view', next)
        return p
      },
      { replace: true },
    )
  const openPayout = (id: string | null) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev)
        if (id) p.set('payout', id)
        else p.delete('payout')
        return p
      },
      { replace: true },
    )
  const counts: Partial<Record<EarningsView, number>> = {
    payouts: summary.payouts.isSuccess ? summary.payouts.data.length : undefined,
    adjustments: summary.adjustments.isSuccess ? summary.adjustments.data.length : undefined,
  }

  return (
    <div className="space-y-4">
      <Tabs value={view} onValueChange={(v) => setView(v as EarningsView)}>
        <TabsList indicator="pill" aria-label="Earnings">
          {VIEWS.map((v) => (
            <TabsTrigger key={v} value={v}>
              {VIEW_LABEL[v]}
              {counts[v] ? <span className="ml-1.5 tabular-nums">{counts[v]}</span> : null}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {view === 'overview' ? (
        <OverviewView s={summary} self={self} tenantId={tenantId} userId={userId} jobs={jobs} onOpen={openPayout} onAll={() => setView('payouts')} actions={actions} />
      ) : view === 'commissions' ? (
        <CommissionsView s={summary} self={self} onOpen={openPayout} />
      ) : view === 'payouts' ? (
        <PayoutsView payouts={summary.payouts} self={self} onOpen={openPayout} />
      ) : view === 'invoices' ? (
        <InvoicesView payouts={summary.payouts} self={self} actions={actions} onOpen={openPayout} />
      ) : (
        <AdjustmentsView adjustments={summary.adjustments} payouts={summary.payouts} self={self} onOpen={openPayout} />
      )}

      <PayoutSheet
        payoutId={payoutId}
        payouts={summary.payouts}
        adjustments={summary.adjustments}
        self={self}
        onClose={() => openPayout(null)}
        actions={actions}
      />
      <InvoiceViewer actions={actions} />
    </div>
  )
}

function OverviewView({
  s,
  self,
  tenantId,
  userId,
  jobs,
  onOpen,
  onAll,
  actions,
}: {
  s: Summary
  self: boolean
  tenantId: string | undefined
  userId: string | null
  jobs: PersonJob[]
  onOpen: (id: string) => void
  onAll: () => void
  actions: ReturnType<typeof useInvoiceActions>
}) {
  const their = self ? 'your' : 'their'
  const them = self ? 'you' : 'them'
  const bank = useBankDetails(tenantId, userId)
  const loadingMoney = s.earnings.isLoading || s.payouts.isLoading
  const loadingPotential = s.jobsLoading || s.openings.isLoading || s.rates.isLoading
  const sp = rateFor(s.rates.data ?? [], 'sp').current?.pct
  const tap = rateFor(s.rates.data ?? [], 'tap').current?.pct
  return (
    <>
      {s.earnings.isError || s.payouts.isError ? (
        <ProfileCard title="Balances" icon={Coins}>
          <LoadError
            what={`${their} earnings`}
            compact
            onRetry={() => {
              void s.earnings.refetch()
              void s.payouts.refetch()
            }}
          />
        </ProfileCard>
      ) : (
        <div>
          <MetricStrip
            id={`os-earnings-${userId}`}
            loading={loadingMoney || loadingPotential}
            items={[
              moneyMetric('Paid this year', Wallet, 'green', s.paidThisYear),
              moneyMetric('In a payout', Send, 'purple', s.inPayout),
              moneyMetric('Payable', CircleDollarSign, 'blue', s.payable),
              moneyMetric('Pending', Clock, 'yellow', s.pending),
              moneyMetric('Potential', TrendingUp, 'pink', s.potential),
            ]}
          />
          <p className="px-1 pt-2 font-inter text-[12px] leading-[1.5] text-[#6B7080]">
            Paid is what Virgilio has paid {them} this year: earned. In a payout is approved and waiting to be paid. A commission is
            payable once the client has paid its invoice in full (or a partner accepted the lead), and pending until then. Potential
            estimates the openings still open where {self ? "you're" : "they're"} a Sourcer or a Recruiter: the job's salary × the opening's
            fee × today's rate{sp != null && tap != null ? ` (Sourcer ${sp}%, Recruiter ${tap}%)` : ''}.
            {!loadingPotential && s.unestimated > 0
              ? ` ${s.unestimated} ${s.unestimated === 1 ? "opening isn't" : "openings aren't"} in it yet: ${s.unestimated === 1 ? 'it has' : 'they have'} no fee, salary or salary period.`
              : ''}
            {bank.data?.has_details ? ` Commissions are paid by bank transfer to ${maskedAccount(bank.data)}.` : ''}
          </p>
        </div>
      )}
      <NextPayoutCard payouts={s.payouts} self={self} onOpen={onOpen} actions={actions} />
      <RecentPayments payouts={s.payouts} self={self} onOpen={onOpen} onAll={onAll} />
      <OpeningsCard s={s} self={self} jobs={jobs} />
    </>
  )
}

function CommissionsView({ s, self, onOpen }: { s: Summary; self: boolean; onOpen: (id: string) => void }) {
  const their = self ? 'your' : 'their'
  const them = self ? 'you' : 'them'
  const { earnings, rows, paidIn, approvedIn, statusOf } = s
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<'all' | LineStatus>('all')
  const [role, setRole] = useState('all')
  const [client, setClient] = useState('all')
  const [period, setPeriod] = useState<PeriodFilter>('all')
  const [currency, setCurrency] = useState('all')
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter(Boolean) as string[])].sort()
  const roles = uniq(rows.map((e) => e.role_label))
  const clients = uniq(rows.map((e) => e.client_name))
  const currencies = uniq(rows.map((e) => e.currency))
  const from = periodFrom(period)
  const term = q.trim().toLowerCase()
  const shownRows = rows.filter(
    (e) =>
      (status === 'all' || statusOf(e) === status) &&
      (role === 'all' || e.role_label === role) &&
      (client === 'all' || e.client_name === client) &&
      (currency === 'all' || e.currency === currency) &&
      (!from || (e.issued_on ?? e.earned_on ?? '') >= from) &&
      (!term ||
        [e.client_name, e.deal_title, e.request_number, e.invoice_number, e.partner_name, e.item_name]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(term)),
  )
  const clearFilters = () => {
    setQ('')
    setStatus('all')
    setRole('all')
    setClient('all')
    setPeriod('all')
    setCurrency('all')
  }

  return (
    <ProfileCard title="Commissions" icon={ReceiptText} flush>
      {rows.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 border-b border-[#EFEEEA] px-4 py-3">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8B8F9E]" aria-hidden />
            <Input
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search clients, requests and invoices"
              aria-label="Search commissions"
              className="h-9 pl-9"
            />
          </div>
          <FilterChipSelect
            label="Status"
            value={status}
            alwaysActive={false}
            onChange={(v) => setStatus(v as 'all' | LineStatus)}
            options={[
              { value: 'all', label: 'Any' },
              { value: 'pending', label: 'Pending' },
              { value: 'payable', label: 'Payable' },
              { value: 'in_payout', label: 'In a payout' },
              { value: 'paid', label: 'Paid' },
              { value: 'void', label: 'Void' },
            ]}
          />
          {roles.length > 1 && (
            <FilterChipSelect
              label="Role"
              value={role}
              alwaysActive={false}
              onChange={setRole}
              options={[{ value: 'all', label: 'Any' }, ...roles.map((r) => ({ value: r, label: r }))]}
            />
          )}
          {clients.length > 1 && (
            <FilterChipSelect
              label="Client"
              value={client}
              alwaysActive={false}
              onChange={setClient}
              options={[{ value: 'all', label: 'Any' }, ...clients.map((c) => ({ value: c, label: c }))]}
            />
          )}
          <FilterChipSelect
            label="Period"
            value={period}
            alwaysActive={false}
            onChange={(v) => setPeriod(v as PeriodFilter)}
            options={PERIODS.map((p) => ({ value: p, label: PERIOD_LABEL[p] }))}
          />
          {currencies.length > 1 && (
            <FilterChipSelect
              label="Currency"
              value={currency}
              alwaysActive={false}
              onChange={setCurrency}
              options={[{ value: 'all', label: 'Any' }, ...currencies.map((c) => ({ value: c, label: c }))]}
            />
          )}
        </div>
      )}
      {earnings.isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-[40px] w-full" />
          ))}
        </div>
      ) : earnings.isError ? (
        <div className="p-4">
          <LoadError what={`${their} commissions`} compact onRetry={() => void earnings.refetch()} />
        </div>
      ) : rows.length === 0 ? (
        <p className="p-4 font-inter text-[12.5px] text-[#6B7080]">No invoices or accepted leads credit {them} yet.</p>
      ) : shownRows.length === 0 ? (
        <p className="p-4 font-inter text-[12.5px] text-[#6B7080]">
          None of the {rows.length} match.{' '}
          <button type="button" onClick={clearFilters} className="font-medium text-[#6F3FF5] underline-offset-2 hover:underline">
            Clear filters
          </button>
        </p>
      ) : (
        <div className="max-h-[560px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice or lead</TableHead>
                <TableHead className="hidden md:table-cell">Role</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="hidden lg:table-cell">Payout</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="hidden sm:table-cell text-right">Pending</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shownRows.map((e) => {
                const st = statusOf(e)
                const payout = paidIn.get(e.sales_credit_id) ?? approvedIn.get(e.sales_credit_id)
                const dot = st === 'paid' ? PAID_OUT : st === 'in_payout' ? IN_PAYOUT : INVOICE_STATUS[e.status]
                const lead = e.source === 'lead'
                const payoutLink = payout ? (
                  <button
                    type="button"
                    onClick={() => onOpen(payout.id)}
                    className="whitespace-nowrap font-medium text-[#1F2230] underline-offset-2 transition-colors duration-hover hover:text-[#6F3FF5] hover:underline"
                  >
                    {monthName(payout.month)}
                  </button>
                ) : null
                return (
                  <TableRow key={e.id}>
                    <TableCell className="max-w-[190px] sm:max-w-[300px]">
                      <span className="block truncate font-medium text-[#1F2230]">
                        {lead
                          ? [e.partner_name ? `Lead accepted by ${e.partner_name}` : 'Lead accepted', e.item_name].filter(Boolean).join(' · ')
                          : [e.request_number, e.invoice_number].filter(Boolean).join(' · ')}
                      </span>
                      <span className="block truncate text-[11.5px] text-[#6B7080]">{[e.client_name, e.deal_title].filter(Boolean).join(' · ') || '—'}</span>
                      <span className="mt-0.5 block text-[11.5px] text-[#5A6072] sm:hidden">
                        <Dot {...dot} />
                      </span>
                      {payoutLink && <span className="mt-0.5 block text-[11.5px] lg:hidden">{payoutLink}</span>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-[#5A6072]">
                      <span className="block whitespace-nowrap">{e.role_label}</span>
                      <span className="block text-[11.5px] text-[#6B7080]">{e.basis === 'fixed' ? 'Fixed amount' : `${e.share_pct}% share`}</span>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Dot {...dot} />
                      <span className="block text-[11.5px] text-[#6B7080]">
                        {st === 'paid'
                          ? payout?.paid_on && `Paid to ${them} ${day(payout.paid_on)}`
                          : st === 'in_payout'
                            ? payout?.invoice_due_on
                              ? `Due ${day(payout.invoice_due_on)}`
                              : 'Approved'
                            : st === 'void'
                              ? (e.void_reason ?? 'Voided in Gio Sales')
                              : lead
                                ? day(e.earned_on)
                                : e.status === 'paid'
                                  ? e.paid_on && `Client paid ${day(e.paid_on)}`
                                  : day(e.issued_on)}
                      </span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-[12.5px]">{payoutLink ?? <span className="text-[#8B8F9E]">—</span>}</TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {st === 'void' || st === 'pending' ? (
                        <span className="text-[#8B8F9E]">—</span>
                      ) : (
                        <Money amount={e.earned_amount} currency={e.currency} />
                      )}
                    </TableCell>
                    <TableCell className="hidden whitespace-nowrap text-right sm:table-cell">
                      {st === 'void' || pendingOf(e) === 0 ? <span className="text-[#8B8F9E]">—</span> : <Money amount={pendingOf(e)} currency={e.currency} />}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </ProfileCard>
  )
}

function OpeningsCard({ s, self, jobs }: { s: Summary; self: boolean; jobs: PersonJob[] }) {
  const their = self ? 'your' : 'their'
  const them = self ? 'you' : 'them'
  const { openings, list, estimates, live, statusOf } = s
  const earningsOf = (o: PersonOpening) => live.filter((e) => e.opening_id === o.id && (e.role_key === 'sp' || e.role_key === 'tap'))
  // What a filled opening has brought so far: payable, in a payout or paid.
  const settled = (e: Earning) => (['payable', 'in_payout', 'paid'].includes(statusOf(e)) ? e.earned_amount : 0)
  return (
    <ProfileCard title="Openings" icon={ListChecks} flush>
      {s.jobsLoading || openings.isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[40px] w-full" />
          ))}
        </div>
      ) : openings.isError ? (
        <div className="p-4">
          <LoadError what={`${their} openings`} compact onRetry={() => void openings.refetch()} />
        </div>
      ) : list.length === 0 ? (
        <p className="p-4 font-inter text-[12.5px] text-[#6B7080]">
          {jobs.some((j) => j.role === 'recruiter' || j.role === 'sourcer')
            ? `No open openings on ${their} jobs, and no hires credit ${them} yet.`
            : `${self ? "You're not" : 'Not'} a Recruiter or a Sourcer on any job, and no hires credit ${them} yet.`}
        </p>
      ) : (
        <div className="max-h-[520px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Job</TableHead>
                <TableHead className="hidden md:table-cell">Seat</TableHead>
                <TableHead className="hidden sm:table-cell">Status</TableHead>
                <TableHead className="hidden md:table-cell">Hire</TableHead>
                <TableHead className="text-right">Commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {list.map((o) => {
                const est = estimates.get(o.id)
                const credits = earningsOf(o)
                return (
                  <TableRow key={o.id}>
                    <TableCell className="max-w-[190px] sm:max-w-[280px]">
                      <JobPreview jobId={o.job_id}>
                        <Link to={`/jobs/${o.job_id}`} className="block truncate font-medium text-[#1F2230] transition-colors duration-hover hover:text-[#6F3FF5]">
                          {o.job?.title ?? 'Job'}
                        </Link>
                      </JobPreview>
                      <span className="block truncate text-[11.5px] text-[#6B7080]">{[o.req_id, o.job?.client].filter(Boolean).join(' · ')}</span>
                      <span className="mt-0.5 block text-[11.5px] text-[#5A6072] sm:hidden">
                        <Dot {...OPENING_STATUS[o.status]} />
                      </span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-[#5A6072]">{SEAT_LABEL[o.role]}</TableCell>
                    <TableCell className="hidden sm:table-cell">
                      <Dot {...OPENING_STATUS[o.status]} />
                      {o.fee_pct != null && <span className="block text-[11.5px] text-[#6B7080]">{o.fee_pct}% fee</span>}
                    </TableCell>
                    <TableCell className="hidden md:table-cell max-w-[200px]">
                      {o.candidate_name ? (
                        <span className="block truncate">{o.candidate_name}</span>
                      ) : (
                        <span className="text-[#8B8F9E]">{o.target_hire_date ? `Target ${day(o.target_hire_date)}` : '—'}</span>
                      )}
                      {o.filled_at && <span className="block text-[11.5px] text-[#6B7080]">{day(o.filled_at)}</span>}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-right">
                      {o.status === 'filled' ? (
                        credits.length ? (
                          <>
                            {byCurrency(credits.map((e) => ({ amount: settled(e), currency: e.currency }))).map((t) => (
                              <span key={t.currency} className="block">
                                <Money amount={t.amount} currency={t.currency} muted={t.amount === 0} />
                              </span>
                            ))}
                            {credits.some((e) => pendingOf(e) > 0) && (
                              <span className="block text-[11.5px] text-[#6B7080]">
                                {byCurrency(credits.map((e) => ({ amount: pendingOf(e), currency: e.currency })))
                                  .map((t) => `${money(t.amount, t.currency).text} pending`)
                                  .join(' · ')}
                              </span>
                            )}
                          </>
                        ) : (
                          <span className="text-[#8B8F9E]">Not invoiced yet</span>
                        )
                      ) : est && 'amount' in est ? (
                        <>
                          <span className="block">
                            ≈ <Money amount={est.amount} currency={est.currency} />
                          </span>
                          <span className="block text-[11.5px] text-[#6B7080]">Estimate</span>
                        </>
                      ) : (
                        <span className="text-[#8B8F9E]">{est && 'missing' in est ? est.missing : '—'}</span>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </ProfileCard>
  )
}

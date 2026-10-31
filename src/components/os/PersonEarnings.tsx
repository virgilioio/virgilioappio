import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CircleDollarSign, Clock, Coins, History, ListChecks, ReceiptText, Search, TrendingUp, Wallet, type LucideIcon } from 'lucide-react'

import { FilterChipSelect } from '@/components/ui/filter-chip-select'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { MetricStrip, type MetricItem, type MetricTone } from '@/components/ui/metric-strip'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { LoadError } from '@/components/empty/LoadError'
import { JobPreview } from '@/components/previews/EntityPreview'
import { ProfileCard } from '@/components/os/ProfileParts'
import { maskedAccount, useBankDetails } from '@/lib/os/bank'
import { rateFor, useCommissionRates } from '@/lib/os/commissions'
import {
  byCurrency,
  estimateOpening,
  money,
  usePersonEarnings,
  usePersonOpenings,
  type Earning,
  type PersonOpening,
} from '@/lib/os/earnings'
import type { PersonJob } from '@/lib/os/peopleAccess'
import { monthName, usePersonPayouts, type PersonPayout } from '@/lib/os/payouts'

const SEAT_LABEL = { sp: 'Sourcer', tap: 'Recruiter' } as const

const OPENING_STATUS = {
  offer: { label: 'In offer', dot: '#F59E0B' },
  open: { label: 'Open', dot: '#0EA5E9' },
  filled: { label: 'Filled', dot: '#12B886' },
} as const
const OPENING_ORDER = { offer: 0, open: 1, filled: 2 } as const

// The commission's status, not the client's invoice (Allan, 2026-10-31): it's
// payable once the client has paid in full (or a partner accepted the lead), and
// earned only when Virgilio pays it out, which reaches Gio ATS with payouts.
const INVOICE_STATUS: Record<Earning['status'], { label: string; dot: string }> = {
  issued: { label: 'Pending · invoiced', dot: '#0EA5E9' },
  partly_paid: { label: 'Pending · client partly paid', dot: '#F59E0B' },
  paid: { label: 'Payable', dot: '#12B886' },
  void: { label: 'Void', dot: '#9CA3AF' },
  earned: { label: 'Payable', dot: '#12B886' },
}

/** What can be paid out: a commission whose invoice the client paid in full, or an accepted lead, not paid out yet. Never counted as earned. */
const payableOf = (e: Earning, paid: Set<string>) =>
  (e.status === 'paid' || e.status === 'earned') && !paid.has(e.sales_credit_id) ? e.earned_amount : 0
/** Paid out to the person in a payout Billing marked paid: earned. */
const paidOutOf = (e: Earning, paid: Set<string>) => (e.status !== 'void' && paid.has(e.sales_credit_id) ? e.earned_amount : 0)
const PAID_OUT = { label: 'Paid', dot: '#0F9F74' }

type StatusFilter = 'all' | 'pending' | 'payable' | 'paid' | 'void'
type PeriodFilter = 'all' | 'year' | 'quarter' | 'd90'
const PERIOD_LABEL: Record<PeriodFilter, string> = { all: 'All time', year: 'This year', quarter: 'This quarter', d90: 'Last 90 days' }

/** The first day a period starts on ("2026-01-01"), in Mexico City's calendar; null for all time. */
function periodFrom(p: PeriodFilter) {
  if (p === 'all') return null
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Mexico_City' })
  const [y, m] = today.split('-').map(Number)
  if (p === 'year') return `${y}-01-01`
  if (p === 'quarter') return `${y}-${String(Math.floor((m - 1) / 3) * 3 + 1).padStart(2, '0')}-01`
  const d = new Date(`${today}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() - 90)
  return d.toISOString().slice(0, 10)
}
/** What waits on the client: the whole commission until its invoice is paid in full. */
const pendingOf = (e: Earning) => (e.status === 'issued' || e.status === 'partly_paid' ? e.earned_amount + e.pending_amount : 0)

function day(iso: string | null) {
  if (!iso) return null
  // A plain date is that day wherever you are, not midnight UTC.
  const at = iso.length === 10 ? new Date(`${iso}T12:00:00Z`) : new Date(iso)
  return at.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', ...(iso.length === 10 ? { timeZone: 'UTC' } : {}) })
}

function Money({ amount, currency, muted }: { amount: number; currency: string; muted?: boolean }) {
  const m = money(amount, currency)
  return (
    <span title={m.title} className={muted ? 'text-[#8B8F9E]' : undefined}>
      {m.text}
    </span>
  )
}

function Dot({ label, dot }: { label: string; dot: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: dot }} aria-hidden />
      {label}
    </span>
  )
}

/** A strip cell: the first currency counts up once per session, any other currency sits under it. */
function moneyMetric(label: string, icon: LucideIcon, tone: MetricTone, sums: { amount: number; currency: string }[]): MetricItem {
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

/**
 * Earnings (piece 4, 2026-10-23): what a person has earned and has pending from
 * Gio Sales' invoices, and an estimate of what their open openings could bring.
 * Filled openings count only when the hire credits them.
 */
/**
 * Paid, Payable, Pending and Potential for one person, worked out once from
 * the payouts, the invoices, the openings and today's rates. Paid is what
 * Virgilio paid out (earned); Payable leaves out what a paid payout covered.
 */
export function useEarningsSummary(userId: string | null, tenantId: string | undefined, jobs: PersonJob[], jobsLoading: boolean) {
  const earnings = usePersonEarnings(userId)
  const payouts = usePersonPayouts(userId)
  const paidPayouts = (payouts.data ?? []).filter((p) => p.status === 'paid')
  const paidIds = new Set(paidPayouts.flatMap((p) => p.sales_credit_ids))
  const paid = byCurrency(paidPayouts.map((p) => ({ amount: p.total, currency: p.currency })))
  const openings = usePersonOpenings(userId, jobs, !jobsLoading)
  const rates = useCommissionRates(tenantId)

  const rows = earnings.data ?? []
  const live = rows.filter((e) => e.status !== 'void')
  const payable = byCurrency(live.filter((e) => payableOf(e, paidIds) > 0).map((e) => ({ amount: payableOf(e, paidIds), currency: e.currency })))
  const pending = byCurrency(live.filter((e) => pendingOf(e) > 0).map((e) => ({ amount: pendingOf(e), currency: e.currency })))

  const list = (openings.data ?? [])
    .slice()
    .sort((a, b) => OPENING_ORDER[a.status] - OPENING_ORDER[b.status] || (b.filled_at ?? '').localeCompare(a.filled_at ?? ''))
  const estimates = new Map(list.filter((o) => o.status !== 'filled').map((o) => [o.id, estimateOpening(o, rates.data ?? [])]))
  const potential = byCurrency([...estimates.values()].flatMap((e) => ('amount' in e ? [{ amount: e.amount, currency: e.currency }] : [])))
  const unestimated = [...estimates.values()].filter((e) => 'missing' in e).length
  const loading = earnings.isLoading || payouts.isLoading || jobsLoading || openings.isLoading || rates.isLoading
  return {
    earnings,
    payouts,
    paidIds,
    paid,
    openings,
    rates,
    rows,
    live,
    list,
    estimates,
    payable,
    pending,
    potential,
    unestimated,
    loading,
  }
}

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
  const their = self ? 'your' : 'their'
  const them = self ? 'you' : 'them'
  const { earnings, payouts, paidIds, paid, openings, rates, rows, live, list, estimates, payable, pending, potential, unestimated } = useEarningsSummary(
    userId,
    tenantId,
    jobs,
    jobsLoading,
  )
  const bank = useBankDetails(tenantId, userId)

  const earningsOf = (o: PersonOpening) => live.filter((e) => e.opening_id === o.id && (e.role_key === 'sp' || e.role_key === 'tap'))

  const loadingMoney = earnings.isLoading || payouts.isLoading
  const loadingPotential = jobsLoading || openings.isLoading || rates.isLoading
  const sp = rateFor(rates.data ?? [], 'sp').current?.pct
  const tap = rateFor(rates.data ?? [], 'tap').current?.pct

  // Filters on Invoices and leads.
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<StatusFilter>('all')
  const [role, setRole] = useState('all')
  const [client, setClient] = useState('all')
  const [period, setPeriod] = useState<PeriodFilter>('all')
  const [currency, setCurrency] = useState('all')
  const uniq = (xs: (string | null)[]) => [...new Set(xs.filter(Boolean) as string[])].sort()
  const roles = uniq(rows.map((e) => e.role_label))
  const clients = uniq(rows.map((e) => e.client_name))
  const currencies = uniq(rows.map((e) => e.currency))
  const paidOnOf = useMemo(() => {
    const m = new Map<string, string | null>()
    for (const p of payouts.data ?? []) if (p.status === 'paid') for (const id of p.sales_credit_ids) m.set(id, p.paid_on)
    return m
  }, [payouts.data])
  const statusOf = (e: Earning): StatusFilter =>
    e.status === 'void'
      ? 'void'
      : paidIds.has(e.sales_credit_id)
        ? 'paid'
        : e.status === 'paid' || e.status === 'earned'
          ? 'payable'
          : 'pending'
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
    <div className="space-y-4">
      {earnings.isError ? (
        <ProfileCard title="Commissions" icon={Coins}>
          <LoadError what={`${their} earnings`} compact onRetry={() => void earnings.refetch()} />
        </ProfileCard>
      ) : (
        <div>
          <MetricStrip
            id={`os-earnings-${userId}`}
            loading={loadingMoney || loadingPotential}
            items={[
              moneyMetric('Paid', Wallet, 'green', paid),
              moneyMetric('Payable', CircleDollarSign, 'blue', payable),
              moneyMetric('Pending', Clock, 'yellow', pending),
              moneyMetric('Potential', TrendingUp, 'purple', potential),
            ]}
          />
        <p className="px-1 pt-2 font-inter text-[12px] leading-[1.5] text-[#6B7080]">
          Paid is what Virgilio has paid {them} in commissions: earned. Payable and pending come from Gio Sales invoices and the leads
          partners accept, for every role that credits {them}: a commission is payable once the client has paid its invoice in full, and
          earned when Virgilio pays it out. Potential estimates the
          openings still open where {self ? "you're" : "they're"} a Sourcer or a Recruiter: the job's salary × the opening's fee × today's rate
          {sp != null && tap != null ? ` (Sourcer ${sp}%, Recruiter ${tap}%)` : ''}.
          {!loadingPotential && unestimated > 0
            ? ` ${unestimated} ${unestimated === 1 ? "opening isn't" : "openings aren't"} in it yet: ${unestimated === 1 ? 'it has' : 'they have'} no fee, salary or salary period.`
            : ''}
          {bank.data?.has_details ? ` Commissions are paid by bank transfer to ${maskedAccount(bank.data)}.` : ''}
        </p>
        </div>
      )}


      <PaymentHistory payouts={payouts} self={self} />

      <ProfileCard title="Invoices and leads" icon={ReceiptText} flush>
        {rows.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-b border-[#EFEEEA] px-4 py-3">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8B8F9E]" aria-hidden />
              <Input
                type="search"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search clients, requests and invoices"
                aria-label="Search invoices and leads"
                className="h-9 pl-9"
              />
            </div>
            <FilterChipSelect
              label="Status"
              value={status}
              alwaysActive={false}
              onChange={(v) => setStatus(v as StatusFilter)}
              options={[
                { value: 'all', label: 'Any' },
                { value: 'pending', label: 'Pending' },
                { value: 'payable', label: 'Payable' },
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
              options={(['all', 'year', 'quarter', 'd90'] as PeriodFilter[]).map((p) => ({ value: p, label: PERIOD_LABEL[p] }))}
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
            <LoadError what={`${their} invoices`} compact onRetry={() => void earnings.refetch()} />
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
          <div className="max-h-[520px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice or lead</TableHead>
                  <TableHead className="hidden md:table-cell">Role</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="text-right">Payable or paid</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shownRows.map((e) => {
                  const out = paidOutOf(e, paidIds) > 0
                  const s = out ? PAID_OUT : INVOICE_STATUS[e.status]
                  const isVoid = e.status === 'void'
                  const lead = e.source === 'lead'
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="max-w-[190px] sm:max-w-[300px]">
                        <span className="block truncate font-medium text-[#1F2230]">
                          {lead
                            ? [e.partner_name ? `Lead accepted by ${e.partner_name}` : 'Lead accepted', e.item_name].filter(Boolean).join(' · ')
                            : [e.request_number, e.invoice_number].filter(Boolean).join(' · ')}
                        </span>
                        <span className="block truncate text-[11.5px] text-[#6B7080]">
                          {[e.client_name, e.deal_title].filter(Boolean).join(' · ') || '—'}
                        </span>
                        <span className="mt-0.5 block text-[11.5px] text-[#5A6072] sm:hidden">
                          <Dot {...s} />
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-[#5A6072]">
                        <span className="block whitespace-nowrap">{e.role_label}</span>
                        <span className="block text-[11.5px] text-[#6B7080]">
                          {e.basis === 'fixed' ? 'Fixed amount' : `${e.share_pct}% share`}
                        </span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <Dot {...s} />
                        <span className="block text-[11.5px] text-[#6B7080]">
                          {out
                            ? paidOnOf.get(e.sales_credit_id) && `Paid to ${them} ${day(paidOnOf.get(e.sales_credit_id) ?? null)}`
                            : isVoid
                            ? e.void_reason ?? 'Voided in Gio Sales'
                            : lead
                              ? day(e.earned_on)
                              : e.status === 'paid'
                                ? e.paid_on && `Client paid ${day(e.paid_on)}`
                                : day(e.issued_on)}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {isVoid ? (
                          <span className="text-[#8B8F9E]">—</span>
                        ) : out ? (
                          <Money amount={paidOutOf(e, paidIds)} currency={e.currency} />
                        ) : (
                          <Money amount={payableOf(e, paidIds)} currency={e.currency} muted={payableOf(e, paidIds) === 0} />
                        )}
                      </TableCell>
                      <TableCell className="hidden whitespace-nowrap text-right sm:table-cell">
                        {isVoid || pendingOf(e) === 0 ? (
                          <span className="text-[#8B8F9E]">—</span>
                        ) : (
                          <Money amount={pendingOf(e)} currency={e.currency} />
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

      <ProfileCard title="Openings" icon={ListChecks} flush>
        {jobsLoading || openings.isLoading ? (
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
                          <Link
                            to={`/jobs/${o.job_id}`}
                            className="block truncate font-medium text-[#1F2230] transition-colors duration-hover hover:text-[#6F3FF5]"
                          >
                            {o.job?.title ?? 'Job'}
                          </Link>
                        </JobPreview>
                        <span className="block truncate text-[11.5px] text-[#6B7080]">
                          {[o.req_id, o.job?.client].filter(Boolean).join(' · ')}
                        </span>
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
                              {byCurrency(credits.map((e) => ({ amount: payableOf(e, paidIds) + paidOutOf(e, paidIds), currency: e.currency }))).map((s) => (
                                <span key={s.currency} className="block">
                                  <Money amount={s.amount} currency={s.currency} muted={s.amount === 0} />
                                </span>
                              ))}
                              {credits.some((e) => pendingOf(e) > 0) && (
                                <span className="block text-[11.5px] text-[#6B7080]">
                                  {byCurrency(credits.map((e) => ({ amount: pendingOf(e), currency: e.currency })))
                                    .map((s) => `${money(s.amount, s.currency).text} pending`)
                                    .join(' · ')}
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-[#8B8F9E]">Not invoiced yet</span>
                          )
                        ) : est && 'amount' in est ? (
                          <>
                            <span className="block">≈ <Money amount={est.amount} currency={est.currency} /></span>
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
    </div>
  )
}

/** Payment history: every payout Virgilio marked paid, newest first, with a period and currency filter. */
function PaymentHistory({ payouts, self }: { payouts: ReturnType<typeof usePersonPayouts>; self: boolean }) {
  const [period, setPeriod] = useState<PeriodFilter>('all')
  const [currency, setCurrency] = useState('all')
  const paid = (payouts.data ?? []).filter((p) => p.status === 'paid')
  const currencies = [...new Set(paid.map((p) => p.currency))].sort()
  const from = periodFrom(period)
  const shown = paid.filter((p) => (currency === 'all' || p.currency === currency) && (!from || (p.paid_on ?? '') >= from))
  const total = byCurrency(shown.map((p) => ({ amount: p.total, currency: p.currency })))
  return (
    <ProfileCard
      title="Payment history"
      icon={History}
      tone="green"
      flush
      aside={
        paid.length > 0 ? (
          <div className="flex flex-wrap items-center justify-end gap-2">
            <FilterChipSelect
              label="Period"
              value={period}
              alwaysActive={false}
              onChange={(v) => setPeriod(v as PeriodFilter)}
              options={(['all', 'year', 'quarter', 'd90'] as PeriodFilter[]).map((p) => ({ value: p, label: PERIOD_LABEL[p] }))}
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
        ) : undefined
      }
    >
      {payouts.isLoading ? (
        <div className="space-y-2 p-4">
          {Array.from({ length: 2 }, (_, i) => (
            <Skeleton key={i} className="h-[40px] w-full" />
          ))}
        </div>
      ) : payouts.isError ? (
        <div className="p-4">
          <LoadError what={self ? 'your payments' : 'their payments'} compact onRetry={() => void payouts.refetch()} />
        </div>
      ) : paid.length === 0 ? (
        <p className="p-4 font-inter text-[12.5px] text-[#6B7080]">
          No commissions paid yet. Each payment shows up here once Virgilio marks it paid.
        </p>
      ) : shown.length === 0 ? (
        <p className="p-4 font-inter text-[12.5px] text-[#6B7080]">No payments in {PERIOD_LABEL[period].toLowerCase()}.</p>
      ) : (
        <div className="max-h-[420px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Paid on</TableHead>
                <TableHead className="hidden sm:table-cell">For</TableHead>
                <TableHead className="hidden md:table-cell">Invoice</TableHead>
                <TableHead className="text-right">Amount</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shown.map((p: PersonPayout) => (
                <TableRow key={p.id}>
                  <TableCell>
                    <span className="block whitespace-nowrap font-medium text-[#1F2230]">{day(p.paid_on)}</span>
                    <span className="block text-[11.5px] text-[#6B7080] sm:hidden">{monthName(p.month)}</span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell max-w-[260px]">
                    <span className="block whitespace-nowrap">{monthName(p.month)}</span>
                    <span className="block truncate text-[11.5px] text-[#6B7080]">
                      {p.historical ? (p.note ?? 'Paid before Commissions') : `${p.lines} ${p.lines === 1 ? 'line' : 'lines'}`}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-[#5A6072]">{p.invoice_number ?? '—'}</TableCell>
                  <TableCell className="whitespace-nowrap text-right font-medium">
                    <Money amount={p.total} currency={p.currency} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between border-t border-[#EFEEEA] px-4 py-3 font-inter text-[12.5px]">
            <span className="text-[#6B7080]">
              {shown.length} {shown.length === 1 ? 'payment' : 'payments'}
              {period !== 'all' ? ` · ${PERIOD_LABEL[period].toLowerCase()}` : ''}
            </span>
            <span className="font-semibold text-[#1F2230] tabular-nums">
              {total.map((t) => money(t.amount, t.currency).text).join(' · ')}
            </span>
          </div>
        </div>
      )}
    </ProfileCard>
  )
}

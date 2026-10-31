import { Link } from 'react-router-dom'
import { CircleDollarSign, Clock, Coins, ListChecks, ReceiptText, TrendingUp, type LucideIcon } from 'lucide-react'

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

/** What can be paid out: a commission whose invoice the client paid in full, or an accepted lead. Never counted as earned. */
const payableOf = (e: Earning) => (e.status === 'paid' || e.status === 'earned' ? e.earned_amount : 0)
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
 * Payable, Pending and Potential for one person, worked out once from the
 * invoices, the openings and today's rates. Paid (earned) joins with payouts.
 */
export function useEarningsSummary(userId: string | null, tenantId: string | undefined, jobs: PersonJob[], jobsLoading: boolean) {
  const earnings = usePersonEarnings(userId)
  const openings = usePersonOpenings(userId, jobs, !jobsLoading)
  const rates = useCommissionRates(tenantId)

  const rows = earnings.data ?? []
  const live = rows.filter((e) => e.status !== 'void')
  const payable = byCurrency(live.filter((e) => payableOf(e) > 0).map((e) => ({ amount: payableOf(e), currency: e.currency })))
  const pending = byCurrency(live.filter((e) => pendingOf(e) > 0).map((e) => ({ amount: pendingOf(e), currency: e.currency })))

  const list = (openings.data ?? [])
    .slice()
    .sort((a, b) => OPENING_ORDER[a.status] - OPENING_ORDER[b.status] || (b.filled_at ?? '').localeCompare(a.filled_at ?? ''))
  const estimates = new Map(list.filter((o) => o.status !== 'filled').map((o) => [o.id, estimateOpening(o, rates.data ?? [])]))
  const potential = byCurrency([...estimates.values()].flatMap((e) => ('amount' in e ? [{ amount: e.amount, currency: e.currency }] : [])))
  const unestimated = [...estimates.values()].filter((e) => 'missing' in e).length
  const loading = earnings.isLoading || jobsLoading || openings.isLoading || rates.isLoading
  return { earnings, openings, rates, rows, live, list, estimates, payable, pending, potential, unestimated, loading }
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
  const { earnings, openings, rates, rows, live, list, estimates, payable, pending, potential, unestimated } = useEarningsSummary(
    userId,
    tenantId,
    jobs,
    jobsLoading,
  )
  const bank = useBankDetails(tenantId, userId)

  const earningsOf = (o: PersonOpening) => live.filter((e) => e.opening_id === o.id && (e.role_key === 'sp' || e.role_key === 'tap'))

  const loadingMoney = earnings.isLoading
  const loadingPotential = jobsLoading || openings.isLoading || rates.isLoading
  const sp = rateFor(rates.data ?? [], 'sp').current?.pct
  const tap = rateFor(rates.data ?? [], 'tap').current?.pct

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
              moneyMetric('Payable', CircleDollarSign, 'green', payable),
              moneyMetric('Pending', Clock, 'yellow', pending),
              moneyMetric('Potential', TrendingUp, 'purple', potential),
            ]}
          />
        <p className="px-1 pt-2 font-inter text-[12px] leading-[1.5] text-[#6B7080]">
          Payable and pending come from Gio Sales invoices and the leads partners accept, for every role that credits {them}. A commission is
          payable once the client has paid its invoice in full, and earned when Virgilio pays it out. Potential estimates the
          openings still open where {self ? "you're" : "they're"} a Sourcer or a Recruiter: the job's salary × the opening's fee × today's rate
          {sp != null && tap != null ? ` (Sourcer ${sp}%, Recruiter ${tap}%)` : ''}.
          {!loadingPotential && unestimated > 0
            ? ` ${unestimated} ${unestimated === 1 ? "opening isn't" : "openings aren't"} in it yet: ${unestimated === 1 ? 'it has' : 'they have'} no fee, salary or salary period.`
            : ''}
          {bank.data?.has_details ? ` Commissions are paid by bank transfer to ${maskedAccount(bank.data)}.` : ''}
        </p>
        </div>
      )}


      <ProfileCard title="Invoices and leads" icon={ReceiptText} flush>
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
        ) : (
          <div className="max-h-[520px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice or lead</TableHead>
                  <TableHead className="hidden md:table-cell">Role</TableHead>
                  <TableHead className="hidden sm:table-cell">Status</TableHead>
                  <TableHead className="text-right">Payable</TableHead>
                  <TableHead className="hidden sm:table-cell text-right">Pending</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((e) => {
                  const s = INVOICE_STATUS[e.status]
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
                          {isVoid
                            ? e.void_reason ?? 'Voided in Gio Sales'
                            : lead
                              ? day(e.earned_on)
                              : e.status === 'paid'
                                ? e.paid_on && `Client paid ${day(e.paid_on)}`
                                : day(e.issued_on)}
                        </span>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right">
                        {isVoid ? <span className="text-[#8B8F9E]">—</span> : <Money amount={payableOf(e)} currency={e.currency} muted={payableOf(e) === 0} />}
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
                              {byCurrency(credits.map((e) => ({ amount: payableOf(e), currency: e.currency }))).map((s) => (
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

import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'
import { formatMoney } from '@/lib/currency'
import { rateFor, type CommissionRate, type CommissionRoleKey } from '@/lib/os/commissions'
import type { PersonJob } from '@/lib/os/peopleAccess'

/**
 * A person's commissions (piece 4, 2026-10-23). Earned and pending come from
 * Gio Sales' invoices (os_earnings, one row per person per invoice, sent by
 * Gio Sales whenever an invoice is issued, paid or voided). Potential is an
 * estimate for the openings still open on the jobs where they are a Sourcer or
 * a Recruiter: the job's salary x the opening's fee x today's rate for the seat.
 * A filled opening counts only when the hire credits them.
 *
 * Since the commission rules (2026-10-26) a row is either an invoice credit
 * (`source = 'invoice'`) or a credit earned when a partner accepted a lead
 * (`source = 'lead'`: no invoice, earned at once, e.g. the SDR's USD 100).
 */

export interface Earning {
  id: string
  source: 'invoice' | 'lead'
  request_number: string | null
  invoice_number: string | null
  client_name: string | null
  deal_title: string | null
  opening_id: string | null
  job_id: string | null
  role_key: string
  role_label: string
  share_pct: number
  basis: 'percent' | 'fixed'
  currency: string
  invoice_amount: number | null
  collected_amount: number
  earned_amount: number
  pending_amount: number
  status: 'issued' | 'partly_paid' | 'paid' | 'void' | 'earned'
  void_reason: string | null
  issued_on: string | null
  paid_on: string | null
  partner_name: string | null
  item_name: string | null
  /** A lead credit: the day the partner accepted. */
  earned_on: string | null
}

export function usePersonEarnings(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['os-person-earnings', userId],
    enabled: !!userId,
    queryFn: async (): Promise<Earning[]> => {
      const { data, error } = await supabase
        .from('os_earnings')
        .select(
          'id, source, request_number, invoice_number, client_name, deal_title, opening_id, job_id, role_key, role_label, share_pct, basis, currency, invoice_amount, collected_amount, earned_amount, pending_amount, status, void_reason, issued_on, paid_on, partner_name, item_name, earned_on',
        )
        .eq('user_id', userId!)
        .order('issued_on', { ascending: false, nullsFirst: false })
        .order('request_number', { ascending: false })
      if (error) throw error
      const rows = (data ?? []).map((r) => ({
        ...r,
        share_pct: Number(r.share_pct),
        invoice_amount: r.invoice_amount == null ? null : Number(r.invoice_amount),
        collected_amount: Number(r.collected_amount),
        earned_amount: Number(r.earned_amount),
        pending_amount: Number(r.pending_amount),
      })) as Earning[]
      // Newest first, an accepted lead by the day it was earned.
      const when = (e: Earning) => e.issued_on ?? e.earned_on ?? ''
      return rows.sort((a, b) => when(b).localeCompare(when(a)))
    },
  })
}

type OpeningStatus = 'open' | 'offer' | 'filled'

export interface EarningJob {
  id: string
  title: string
  client: string | null
  salary_min: number | null
  salary_max: number | null
  salary_period: string | null
  currency: string | null
}

export interface PersonOpening {
  id: string
  job_id: string
  req_id: string | null
  status: OpeningStatus
  candidate_name: string | null
  filled_at: string | null
  fee_pct: number | null
  target_hire_date: string | null
  /** The commission seat: who the hire credits (filled) or the seat they hold (open, in offer). */
  role: Extract<CommissionRoleKey, 'sp' | 'tap'>
  job: EarningJob | null
}

const SEAT_ROLE: Record<string, 'sp' | 'tap'> = { sourcer: 'sp', recruiter: 'tap' }

/**
 * Open and in-offer openings on the jobs where they hold a Sourcer or Recruiter
 * seat, and every filled opening whose hire credits them (wherever their seat is
 * now). Cancelled openings and hires that credit someone else are left out.
 */
export function usePersonOpenings(userId: string | null | undefined, seats: PersonJob[], seatsReady = true) {
  const seatRole = new Map(seats.filter((s) => SEAT_ROLE[s.role]).map((s) => [s.job_id, SEAT_ROLE[s.role]]))
  const seatIds = [...seatRole.keys()].sort()
  return useQuery({
    queryKey: ['os-person-openings', userId, seatIds.join(',')],
    enabled: !!userId && seatsReady,
    queryFn: async (): Promise<PersonOpening[]> => {
      const credited = await supabase
        .from('job_openings')
        .select('id, job_id, sourcer_user_id, recruiter_user_id')
        .or(`sourcer_user_id.eq.${userId},recruiter_user_id.eq.${userId}`)
        .not('filled_at', 'is', null)
      if (credited.error) throw credited.error
      const creditOf = new Map<string, 'sp' | 'tap'>()
      for (const o of credited.data ?? []) creditOf.set(o.id, o.recruiter_user_id === userId ? 'tap' : 'sp')
      const jobIds = [...new Set([...seatIds, ...(credited.data ?? []).map((o) => o.job_id)])]
      if (jobIds.length === 0) return []

      const [openings, jobs] = await Promise.all([
        supabase
          .from('job_openings_with_status')
          .select('id, job_id, req_id, status, candidate_name, filled_at, fee_pct, target_hire_date')
          .in('job_id', jobIds),
        supabase
          .from('jobs')
          .select('id, title, salary_min, salary_max, salary_period, currency, organizations(name)')
          .in('id', jobIds),
      ])
      if (openings.error) throw openings.error
      if (jobs.error) throw jobs.error
      type JobRow = Omit<EarningJob, 'client'> & { organizations: { name: string } | null }
      const jobOf = new Map(
        ((jobs.data ?? []) as unknown as JobRow[]).map(({ organizations, ...j }) => [j.id, { ...j, client: organizations?.name ?? null }]),
      )

      const out: PersonOpening[] = []
      for (const o of openings.data ?? []) {
        if (!o.id || !o.job_id) continue
        const role = o.status === 'filled' ? creditOf.get(o.id) : o.status === 'open' || o.status === 'offer' ? seatRole.get(o.job_id) : undefined
        if (!role) continue
        out.push({
          id: o.id,
          job_id: o.job_id,
          req_id: o.req_id,
          status: o.status as OpeningStatus,
          candidate_name: o.candidate_name,
          filled_at: o.filled_at,
          fee_pct: o.fee_pct == null ? null : Number(o.fee_pct),
          target_hire_date: o.target_hire_date,
          role,
          job: jobOf.get(o.job_id) ?? null,
        })
      }
      return out
    },
  })
}

export type Estimate = { amount: number; currency: string; rate: number } | { missing: string }

/** Potential commission on an open opening: annual salary x fee x today's rate for the seat. */
export function estimateOpening(o: PersonOpening, rates: CommissionRate[]): Estimate {
  if (o.fee_pct == null) return { missing: 'No fee set' }
  const j = o.job
  const lo = j?.salary_min ?? null
  const hi = j?.salary_max ?? null
  if (lo == null && hi == null) return { missing: 'No salary' }
  const salary = lo != null && hi != null ? (lo + hi) / 2 : (lo ?? hi)!
  const annual = j?.salary_period === 'annual' ? salary : j?.salary_period === 'monthly' ? salary * 12 : null
  if (annual == null) return { missing: 'No salary period' }
  const rate = rateFor(rates, o.role).current?.pct
  if (rate == null) return { missing: 'No rate' }
  return { amount: Math.round(((annual * o.fee_pct) / 100) * (rate / 100)), currency: (j?.currency || 'USD').toUpperCase(), rate }
}

/** Sums by currency, USD first. */
export function byCurrency(items: { amount: number; currency: string }[]) {
  const sums = new Map<string, number>()
  for (const i of items) sums.set(i.currency, (sums.get(i.currency) ?? 0) + i.amount)
  return [...sums.entries()]
    .map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => (a.currency === 'USD' ? -1 : b.currency === 'USD' ? 1 : a.currency.localeCompare(b.currency)))
}

/** Money for a cell: compact over a million (12.45M), with the exact amount for the title. */
export function money(amount: number, currency: string) {
  const exact = formatMoney(amount, currency, { decimals: Number.isInteger(amount) ? 0 : 2, suffixCode: currency !== 'USD' })
  if (Math.abs(amount) < 1_000_000) return { text: exact, title: undefined }
  const compact = `${formatMoney(Math.round(amount / 10_000) / 100, currency, { decimals: 2 })}M${currency !== 'USD' ? ` ${currency}` : ''}`
  return { text: compact, title: exact }
}

import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/integrations/supabase/client'
import { byCurrency } from '@/lib/os/earnings'

/**
 * Commission payouts from Gio Sales (phase 2, 2026-10-31): each payout Billing
 * marked paid, kept in os_commission_payouts by sales_commission_payout_upsert
 * (`commissions.payout` through sales-earnings). Only a paid payout is earned
 * (Allan, 2026-10-31); one Billing took back to approved stays, no longer
 * counted. `sales_credit_ids` names the commissions it paid (os_earnings'
 * sales_credit_id), so those leave Payable. The person reads their own;
 * People & Access admins read everyone's.
 *
 * Since phase 3 (2026-10-31) a payout arrives when it's approved too (drafts
 * never), with its lines as they read on the invoice (`items`), the invoice's
 * dates and whether Gio's PDF and the member's own invoice are on it; and
 * os_commission_adjustments holds each adjustment on their pay (removed ones
 * stay in the table but never show).
 */
export interface PersonPayout {
  id: string
  sales_payout_id: string
  month: string
  currency: string
  total: number
  status: 'approved' | 'paid'
  paid_on: string | null
  lines: number
  invoice_number: string | null
  historical: boolean
  note: string | null
  sales_credit_ids: string[]
  items: PayoutItem[]
  approved_on: string | null
  invoice_issued_on: string | null
  invoice_due_on: string | null
  has_invoice_pdf: boolean
  has_own_invoice: boolean
}

/** One line of a payout, as it reads on the invoice. Adjustments carry their sign. */
export interface PayoutItem {
  kind: 'credit' | 'lead' | 'adjustment'
  id: string
  description: string
  amount: number
}

const asItems = (v: unknown): PayoutItem[] =>
  Array.isArray(v)
    ? (v as Record<string, unknown>[])
        .filter((i) => i && typeof i.id === 'string')
        .map((i) => ({
          kind: i.kind === 'lead' || i.kind === 'adjustment' ? i.kind : 'credit',
          id: String(i.id),
          description: String(i.description ?? ''),
          amount: Number(i.amount ?? 0),
        }))
    : []

export function usePersonPayouts(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['os-person-payouts', userId],
    enabled: !!userId,
    queryFn: async (): Promise<PersonPayout[]> => {
      const { data, error } = await supabase
        .from('os_commission_payouts')
        .select('*')
        .eq('user_id', userId!)
        .order('paid_on', { ascending: false, nullsFirst: false })
        .order('month', { ascending: false })
      if (error) throw error
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        ...(r as unknown as PersonPayout),
        total: Number(r.total ?? 0),
        lines: Number(r.lines ?? 0),
        sales_credit_ids: Array.isArray(r.sales_credit_ids) ? (r.sales_credit_ids as string[]) : [],
        items: asItems(r.items),
        has_invoice_pdf: r.has_invoice_pdf === true,
        has_own_invoice: r.has_own_invoice === true,
      }))
    },
  })
}

export const monthName = (month: string) =>
  new Date(`${month.slice(0, 7)}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })

/** "Oct 2026": a payout's month, short, for a phone row. */
export const monthShort = (month: string) =>
  new Date(`${month.slice(0, 7)}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' })

/** The payouts Billing approved and hasn't paid yet: what comes next, oldest first. */
export const upcomingPayouts = (payouts: PersonPayout[]) =>
  payouts.filter((p) => p.status === 'approved').sort((a, b) => a.month.localeCompare(b.month))

/** Commission ids in an approved payout (not paid yet): they read "In a payout", not Payable. */
export function inPayoutIds(payouts: PersonPayout[]) {
  const m = new Map<string, PersonPayout>()
  for (const p of payouts) if (p.status === 'approved') for (const id of p.sales_credit_ids) m.set(id, p)
  return m
}

/** What the approved payouts add up to, per currency. */
export const inPayoutTotals = (payouts: PersonPayout[]) =>
  byCurrency(upcomingPayouts(payouts).map((p) => ({ amount: p.total, currency: p.currency })))

export type AdjustmentKind = 'bonus' | 'correction' | 'clawback' | 'other' | 'carry_over'
export const ADJUSTMENT_LABEL: Record<AdjustmentKind, string> = {
  bonus: 'Bonus',
  correction: 'Correction',
  clawback: 'Clawback',
  other: 'Other',
  carry_over: 'Carry-over',
}

export interface PersonAdjustment {
  id: string
  sales_adjustment_id: string
  kind: AdjustmentKind
  amount: number
  currency: string
  reason: string
  month: string
  sales_payout_id: string | null
  added_at: string
}

/** The adjustments on a person's pay that still stand (removed and dismissed ones never show), newest first. */
export function usePersonAdjustments(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['os-person-adjustments', userId],
    enabled: !!userId,
    queryFn: async (): Promise<PersonAdjustment[]> => {
      const { data, error } = await supabase
        .from('os_commission_adjustments')
        .select('id, sales_adjustment_id, kind, amount, currency, reason, month, sales_payout_id, added_at')
        .eq('user_id', userId!)
        .eq('status', 'active')
        .order('added_at', { ascending: false })
      if (error) throw error
      return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
        ...(r as unknown as PersonAdjustment),
        amount: Number(r.amount ?? 0),
      }))
    },
  })
}

export type InvoiceFile = 'invoice' | 'own'

/**
 * A 5-minute link to a payout's invoice: Gio's PDF (`invoice`) or the one the
 * member uploaded (`own`). commission-invoice-link checks the payout is one
 * the caller may read (their own, or an admin's), then asks Gio Sales for it;
 * nothing is copied into Gio ATS.
 */
export async function invoiceLink(payoutId: string, which: InvoiceFile): Promise<{ url: string; filename: string }> {
  const { data, error } = await supabase.functions.invoke('commission-invoice-link', { body: { payout_id: payoutId, which } })
  if (error || !data?.url) throw new Error("Couldn't open the invoice. Try again.")
  return data as { url: string; filename: string }
}

/** Saves the file under its own name: fetched as a blob, since a link to another site can't name a download. */
export async function downloadInvoice(payoutId: string, which: InvoiceFile) {
  const { url, filename } = await invoiceLink(payoutId, which)
  const res = await fetch(url)
  if (!res.ok) throw new Error("Couldn't download the invoice. Try again.")
  const href = URL.createObjectURL(await res.blob())
  const a = document.createElement('a')
  a.href = href
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(href), 1000)
}

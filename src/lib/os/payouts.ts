import { useQuery } from '@tanstack/react-query'

import { supabase } from '@/integrations/supabase/client'

/**
 * Commission payouts from Gio Sales (phase 2, 2026-10-31): each payout Billing
 * marked paid, kept in os_commission_payouts by sales_commission_payout_upsert
 * (`commissions.payout` through sales-earnings). Only a paid payout is earned
 * (Allan, 2026-10-31); one Billing took back to approved stays, no longer
 * counted. `sales_credit_ids` names the commissions it paid (os_earnings'
 * sales_credit_id), so those leave Payable. The person reads their own;
 * People & Access admins read everyone's.
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
}

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
      }))
    },
  })
}

export const monthName = (month: string) =>
  new Date(`${month.slice(0, 7)}-01T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })

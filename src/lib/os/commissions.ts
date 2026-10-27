import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { supabase } from '@/lib/supabaseClient'

/**
 * Commission rules (Allan, 2026-10-23). Each role's share of the net revenue
 * Virgilio collects on a placement (salary x success fee %), with the date it
 * applies from. People & Access owns them (os_commission_rates); os-sync
 * delivers each new one to Gio Sales, whose invoices use its own copy.
 * Rates are never edited: a change is a new rate with a later date.
 */

export type CommissionRoleKey = 'sales_new' | 'sales_existing' | 'es' | 'sp' | 'tap'

export const COMMISSION_ROLES: { key: CommissionRoleKey; label: string; source: string }[] = [
  { key: 'tap', label: 'Recruiter', source: 'From the hire in Gio ATS' },
  { key: 'sp', label: 'Sourcer', source: 'From the hire in Gio ATS' },
  { key: 'es', label: 'Engagement Specialist', source: 'From the deal in Gio Sales' },
  { key: 'sales_new', label: 'Sales, new client', source: 'From the deal in Gio Sales' },
  { key: 'sales_existing', label: 'Sales, existing client', source: 'From the deal in Gio Sales' },
]

export const commissionRoleLabel = (key: string) => COMMISSION_ROLES.find((r) => r.key === key)?.label ?? key

export interface CommissionRate {
  id: string
  role_key: CommissionRoleKey
  pct: number
  effective_from: string
  note: string | null
  created_by: string | null
  created_at: string
  sync_status: 'pending' | 'done' | 'refused'
  sync_error: string | null
  synced_at: string | null
}

const key = (tenantId: string | undefined) => ['os-commission-rates', tenantId] as const

export function useCommissionRates(tenantId: string | undefined) {
  return useQuery({
    queryKey: key(tenantId),
    enabled: !!tenantId,
    queryFn: async (): Promise<CommissionRate[]> => {
      const { data, error } = await supabase
        .from('os_commission_rates')
        .select('id, role_key, pct, effective_from, note, created_by, created_at, sync_status, sync_error, synced_at')
        .eq('tenant_id', tenantId!)
        .order('effective_from', { ascending: false })
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data ?? []).map((r) => ({ ...r, pct: Number(r.pct) })) as CommissionRate[]
    },
  })
}

/** Today's date as YYYY-MM-DD in the browser's time zone. */
export const todayIso = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/**
 * The rate in force for a role on a day, and the next one scheduled after it.
 * A rate Gio Sales refused is left out: its invoices will never use it.
 */
export function rateFor(rates: CommissionRate[], role: CommissionRoleKey, on = todayIso()) {
  const mine = rates.filter((r) => r.role_key === role && r.sync_status !== 'refused').sort((a, b) => a.effective_from.localeCompare(b.effective_from))
  const current = [...mine].reverse().find((r) => r.effective_from <= on) ?? null
  const next = mine.find((r) => r.effective_from > on) ?? null
  return { current, next }
}

/** Asks os-sync to deliver waiting rates now (the cron also retries every few minutes). */
export async function sendRatesNow(tenantId: string) {
  await supabase.functions.invoke('os-sync', { body: { tenant_id: tenantId } })
}

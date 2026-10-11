import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabaseClient'

export interface SourcingCreditsUsage {
  tenant_id: string
  
  // Enrichment credits (pooled per organization based on seats)
  collect_credits_used: number
  collect_credits_limit: number
  collect_percentage: number
  
  // Bonus credits (purchased add-ons)
  bonus_credits_available: number
  bonus_credits_purchased: number
  bonus_credits_used: number
  
  // Subscription info
  subscription_tier: string | null
  billing_status: string
  billing_interval: 'month' | 'year' | null
  seat_quantity: number
  
  // Cycle info
  next_reset: string
  billing_cycle_start: string
  
  // Legacy fields for backward compatibility
  search_credits_used: number
  search_credits_limit: number
  search_percentage: number
  created_at: string
  updated_at: string
}

/** "Oct 19": the day Apollo's credits renew, for messages. */
export function creditsRenewLabel(usage: Pick<SourcingCreditsUsage, 'next_reset'> | null | undefined): string {
  if (!usage?.next_reset) return 'the next cycle'
  return new Date(usage.next_reset).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/**
 * The workspace's Apollo balance (Find Phase 0, 2026-10-11): read from
 * apollo_credit_status(), the same function the server checks before every
 * collect. Credits are what Apollo bills (the ledger), on Apollo's own cycle.
 * The old per-seat and bonus fields stay in the shape for the screens that
 * read them; bonus credits are always 0.
 */
export function useSourcingCredits() {
  const { organizationId } = useAuth()

  return useQuery<SourcingCreditsUsage | null>({
    queryKey: ['sourcing-credits', organizationId],
    queryFn: async () => {
      if (!organizationId) return null

      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('tenant_id')
        .eq('id', organizationId)
        .single()
      if (orgError || !org?.tenant_id) return null

      const { data, error } = await supabase.rpc('apollo_credit_status', { p_tenant: org.tenant_id })
      if (error) throw error
      const st = Array.isArray(data) ? data[0] : data
      if (!st) return null

      const limit = st.configured ? st.monthly_credits : 0
      const used = st.configured ? st.used : 0
      const now = new Date().toISOString()
      return {
        tenant_id: org.tenant_id,
        collect_credits_used: used,
        collect_credits_limit: limit,
        collect_percentage: limit > 0 ? Math.round((used / limit) * 100) : 0,
        bonus_credits_available: 0,
        bonus_credits_purchased: 0,
        bonus_credits_used: 0,
        subscription_tier: null,
        billing_status: st.configured ? 'active' : 'not_set_up',
        billing_interval: 'month',
        seat_quantity: 1,
        next_reset: st.cycle_end ?? now,
        billing_cycle_start: st.cycle_start ?? now,
        search_credits_used: 0,
        search_credits_limit: 0,
        search_percentage: 0,
        created_at: st.cycle_start ?? now,
        updated_at: now,
      }
    },
    enabled: !!organizationId,
    refetchInterval: 30000,
    staleTime: 10000
  })
}

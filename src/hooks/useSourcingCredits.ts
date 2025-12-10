import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabaseClient'

export interface SourcingCreditsUsage {
  tenant_id: string
  billing_cycle_start: string
  search_credits_used: number
  collect_credits_used: number
  search_credits_limit: number
  collect_credits_limit: number
  subscription_tier: 'solo' | 'launch' | 'growth' | 'business'
  billing_status: string
  next_reset: string
  search_percentage: number
  collect_percentage: number
  created_at: string
  updated_at: string
}

export function useSourcingCredits() {
  const { organizationId } = useAuth()

  return useQuery<SourcingCreditsUsage | null>({
    queryKey: ['sourcing-credits', organizationId],
    queryFn: async () => {
      if (!organizationId) return null

      // Step 1: Resolve tenant_id
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('tenant_id')
        .eq('id', organizationId)
        .single()

      if (orgError || !org?.tenant_id) {
        console.error('Failed to resolve tenant_id:', orgError)
        return null
      }

      const tenantId = org.tenant_id

      // Step 2: Get subscription info
      const { data: subscription, error: subError } = await supabase
        .from('tenant_subscriptions')
        .select('subscription_tier, billing_status, current_period_start, billing_interval, trial_started_at')
        .eq('tenant_id', tenantId)
        .single()

      if (subError) {
        console.error('Failed to fetch subscription:', subError)
        return null
      }

      // Determine billing cycle start for reference only
      let billingCycleStart: Date
      if (subscription.billing_status === 'trialing' && subscription.trial_started_at) {
        billingCycleStart = new Date(subscription.trial_started_at)
      } else if (subscription.current_period_start) {
        billingCycleStart = new Date(subscription.current_period_start)
      } else {
        const now = new Date()
        billingCycleStart = new Date(now.getFullYear(), now.getMonth(), 1)
      }

      // Step 3: Query usage - get most recent record for this tenant
      const { data, error } = await supabase
        .from('sourcing_credits_usage')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      // Create new record if doesn't exist
      if (!data) {
        // Get correct credit limits based on subscription tier
        const { data: limits, error: limitsError } = await supabase
          .rpc('get_tenant_credit_limits', { p_tenant_id: tenantId })
          .single()

        if (limitsError) {
          console.error('Failed to get credit limits:', limitsError)
          throw limitsError
        }

        const { data: newRecord, error: insertError } = await supabase
          .from('sourcing_credits_usage')
          .insert({
            tenant_id: tenantId,
            billing_cycle_start: billingCycleStart.toISOString(),
            search_credits_limit: limits.search_limit,
            collect_credits_limit: limits.collect_limit
          })
          .select()
          .single()

        if (insertError) throw insertError

        const nextReset = new Date(billingCycleStart)
        const interval = subscription.billing_interval === 'year' ? 12 : 1
        nextReset.setMonth(nextReset.getMonth() + interval)

        return {
          ...newRecord,
          subscription_tier: (subscription.subscription_tier || 'launch') as 'solo' | 'launch' | 'growth' | 'business',
          billing_status: subscription.billing_status,
          next_reset: nextReset.toISOString(),
          search_percentage: 0,
          collect_percentage: 0
        }
      }

      // Calculate next reset based on the actual billing_cycle_start from the record
      const recordCycleStart = new Date(data.billing_cycle_start)
      const nextReset = new Date(recordCycleStart)
      const interval = subscription.billing_interval === 'year' ? 12 : 1
      nextReset.setMonth(nextReset.getMonth() + interval)

      return {
        ...data,
        subscription_tier: (subscription.subscription_tier || 'launch') as 'solo' | 'launch' | 'growth' | 'business',
        billing_status: subscription.billing_status,
        next_reset: nextReset.toISOString(),
        search_percentage: Math.round((data.search_credits_used / data.search_credits_limit) * 100),
        collect_percentage: Math.round((data.collect_credits_used / data.collect_credits_limit) * 100)
      }
    },
    enabled: !!organizationId,
    refetchInterval: 30000,
    staleTime: 10000
  })
}

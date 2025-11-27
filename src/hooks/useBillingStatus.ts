import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

export interface BillingStatus {
  billing_status: 'trialing' | 'active' | 'past_due' | 'canceled' | 'locked' | 'grace_period'
  trial_ends_at: string | null
  trial_started_at: string | null
  subscription_end: string | null
  seat_quantity: number
  days_until_trial_end: number | null
  hours_until_trial_end: number | null
  days_until_lockout: number | null
  billing_interval: 'month' | 'year' | null
  stripe_subscription_id: string | null
  subscribed: boolean
  subscription_tier: 'solo' | 'launch' | 'growth' | 'business' | null
}

export function useBillingStatus() {
  const { organizationId } = useAuth()

  return useQuery({
    queryKey: ['billing-status', organizationId],
    queryFn: async (): Promise<BillingStatus | null> => {
      if (!organizationId) return null

      // Get tenant_id for this organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('tenant_id')
        .eq('id', organizationId)
        .single()

      if (orgError || !org?.tenant_id) {
        console.error('[useBillingStatus] No tenant_id found:', orgError)
        return null
      }

      // Fetch billing status from tenant_subscriptions
      const { data, error } = await supabase
        .from('tenant_subscriptions')
        .select(`
          billing_status,
          trial_ends_at,
          trial_started_at,
          subscription_end,
          seat_quantity,
          billing_interval,
          stripe_subscription_id,
          subscribed,
          subscription_tier
        `)
        .eq('tenant_id', org.tenant_id)
        .single()

      if (error) {
        console.error('[useBillingStatus] Failed to fetch billing status:', error)
        return null
      }

      if (!data) return null

      // Compute time until trial end and lockout
      const now = new Date()
      const trialEnd = data.trial_ends_at ? new Date(data.trial_ends_at) : null
      
      const daysUntilTrialEnd = trialEnd 
        ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : null
      
      const hoursUntilTrialEnd = trialEnd
        ? Math.max(0, Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60)))
        : null
      
      // Calculate days until lockout (trial end + 7 days grace period)
      let daysUntilLockout: number | null = null
      if (data.billing_status === 'grace_period' && trialEnd) {
        const lockoutDate = new Date(trialEnd)
        lockoutDate.setDate(lockoutDate.getDate() + 7)
        daysUntilLockout = Math.max(0, Math.ceil((lockoutDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
      }

      return {
        billing_status: (data.billing_status || 'locked') as BillingStatus['billing_status'],
        trial_ends_at: data.trial_ends_at,
        trial_started_at: data.trial_started_at,
        subscription_end: data.subscription_end,
        seat_quantity: data.seat_quantity || 0,
        billing_interval: data.billing_interval as BillingStatus['billing_interval'],
        stripe_subscription_id: data.stripe_subscription_id,
        subscribed: data.subscribed,
        subscription_tier: data.subscription_tier as BillingStatus['subscription_tier'],
        days_until_trial_end: daysUntilTrialEnd,
        hours_until_trial_end: hoursUntilTrialEnd,
        days_until_lockout: daysUntilLockout,
      }
    },
    enabled: !!organizationId,
    refetchInterval: 60000, // Refetch every 60 seconds to catch trial expiration
    staleTime: 30000, // Consider data stale after 30 seconds
  })
}

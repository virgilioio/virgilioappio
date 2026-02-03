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

      // Step 2: Get subscription info including seat count and bonus credits
      const { data: subscription, error: subError } = await supabase
        .from('tenant_subscriptions')
        .select(`
          subscription_tier, 
          billing_status, 
          current_period_start, 
          billing_interval, 
          trial_started_at,
          seat_quantity,
          bonus_credits_purchased,
          bonus_credits_used
        `)
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

      // Calculate credits per seat based on billing interval (per-seat model)
      const seatQuantity = subscription.seat_quantity || 1
      const isAnnual = subscription.billing_interval === 'year'
      const isTrialing = subscription.billing_status === 'trialing'
      
      // Trial users get fixed 5 credits (matches get_tenant_credit_limits backend)
      // Paid users get per-seat calculation
      const calculatedLimit = isTrialing 
        ? 5 
        : seatQuantity * (isAnnual ? 120 : 100)
      
      // Admin overrides should ALWAYS win - use Math.max for both cases
      // This respects manual credit assignments regardless of billing status
      const databaseLimit = data?.collect_credits_limit || 0
      const collectLimit = Math.max(calculatedLimit, databaseLimit)

      // Bonus credits calculation
      const bonusPurchased = subscription.bonus_credits_purchased || 0
      const bonusUsed = subscription.bonus_credits_used || 0
      const bonusAvailable = Math.max(0, bonusPurchased - bonusUsed)

      // Calculate next reset
      const nextReset = new Date(billingCycleStart)
      const interval = subscription.billing_interval === 'year' ? 12 : 1
      nextReset.setMonth(nextReset.getMonth() + interval)

      // Create new record if doesn't exist
      if (!data) {
        const { data: newRecord, error: insertError } = await supabase
          .from('sourcing_credits_usage')
          .insert({
            tenant_id: tenantId,
            billing_cycle_start: billingCycleStart.toISOString(),
            search_credits_limit: 0, // Searches are now free
            collect_credits_limit: collectLimit
          })
          .select()
          .single()

        if (insertError) throw insertError

        return {
          ...newRecord,
          collect_credits_limit: collectLimit,
          collect_percentage: 0,
          bonus_credits_available: bonusAvailable,
          bonus_credits_purchased: bonusPurchased,
          bonus_credits_used: bonusUsed,
          subscription_tier: subscription.subscription_tier || null,
          billing_status: subscription.billing_status,
          billing_interval: subscription.billing_interval as 'month' | 'year' | null,
          seat_quantity: seatQuantity,
          next_reset: nextReset.toISOString(),
          // Legacy fields
          search_credits_used: 0,
          search_credits_limit: 0,
          search_percentage: 0,
        }
      }

      const collectUsed = data.collect_credits_used || 0

      return {
        ...data,
        collect_credits_limit: collectLimit,
        collect_percentage: collectLimit > 0 ? Math.round((collectUsed / collectLimit) * 100) : 0,
        bonus_credits_available: bonusAvailable,
        bonus_credits_purchased: bonusPurchased,
        bonus_credits_used: bonusUsed,
        subscription_tier: subscription.subscription_tier || null,
        billing_status: subscription.billing_status,
        billing_interval: subscription.billing_interval as 'month' | 'year' | null,
        seat_quantity: seatQuantity,
        next_reset: nextReset.toISOString(),
        // Legacy fields (searches are now free)
        search_credits_used: 0,
        search_credits_limit: 0,
        search_percentage: 0,
      }
    },
    enabled: !!organizationId,
    refetchInterval: 30000,
    staleTime: 10000
  })
}

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { log } from '@/lib/logger'

/**
 * Optional hook to detect if Stripe is configured.
 * Checks if the check-subscription edge function responds successfully.
 * Used to show configuration warnings in the UI.
 */
export function useStripeConfigured() {
  return useQuery({
    queryKey: ['stripe-configured'],
    queryFn: async () => {
      try {
        log.info('Checking Stripe configuration')
        
        // Try to call the check-subscription function
        const { error } = await supabase.functions.invoke('check-subscription', {
          body: {}
        })

        // If it responds without error, Stripe is likely configured
        const isConfigured = !error
        
        log.info('Stripe configured:', isConfigured)
        return isConfigured
      } catch (error) {
        log.warn('Stripe configuration check failed:', error)
        return false
      }
    },
    // Cache the result for 5 minutes
    staleTime: 5 * 60 * 1000,
    // Don't retry on failure - likely means Stripe isn't configured
    retry: false
  })
}

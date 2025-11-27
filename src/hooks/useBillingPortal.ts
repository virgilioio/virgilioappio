import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'
import { withAuthRetry } from '@/lib/authUtils'
import { extractErrorMessage } from '@/lib/authUtils'
import { log } from '@/lib/logger'

export function useOpenBillingPortal() {
  return useMutation({
    mutationFn: async () => {
      log.info('Opening Stripe billing portal')
      
      return withAuthRetry(async () => {
        const { data, error } = await supabase.functions.invoke('customer-portal', {
          body: {}
        })

        if (error) throw error
        
        if (!data || !data.url) {
          throw new Error('Billing portal URL not available')
        }

        return data
      })
    },
    onSuccess: (data) => {
      log.info('Opening billing portal in new tab')
      window.open(data.url, '_blank')
      
      toast({
        title: 'Opening billing portal',
        description: 'Stripe billing portal is opening in a new tab.',
      })
    },
    onError: (error) => {
      log.error('Failed to open billing portal:', error)
      
      const errorMessage = extractErrorMessage(error)
      const isConfigError = errorMessage.includes('not available') || errorMessage.includes('not configured')
      
      toast({
        variant: 'destructive',
        title: isConfigError ? 'Billing not configured' : 'Portal access failed',
        description: isConfigError 
          ? 'Billing integration is not set up yet. Contact support for assistance.'
          : errorMessage,
      })
    }
  })
}

interface CreateCheckoutParams {
  interval?: 'month' | 'year'
  tier?: 'solo' | 'launch' | 'growth' | 'business'
}

export function useCreateCheckout() {
  return useMutation({
    mutationFn: async ({ interval = 'month', tier = 'launch' }: CreateCheckoutParams = {}) => {
      log.info('Creating Stripe checkout session', { interval, tier })
      
      return withAuthRetry(async () => {
        const { data, error } = await supabase.functions.invoke('create-checkout', {
          body: { interval, tier }
        })

        if (error) throw error
        
        if (!data || !data.url) {
          throw new Error('Checkout URL not available')
        }

        return data
      })
    },
    onSuccess: (data) => {
      log.info('Redirecting to Stripe checkout')
      window.location.href = data.url
    },
    onError: (error) => {
      log.error('Failed to create checkout session:', error)
      
      const errorMessage = extractErrorMessage(error)
      const isConfigError = errorMessage.includes('not available') || errorMessage.includes('not configured')
      
      toast({
        variant: 'destructive',
        title: isConfigError ? 'Billing not configured' : 'Checkout failed',
        description: isConfigError 
          ? 'Billing integration is not set up yet. Contact support for assistance.'
          : errorMessage,
      })
    }
  })
}

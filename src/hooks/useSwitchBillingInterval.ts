import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { toast } from './use-toast'

interface SwitchBillingIntervalParams {
  newInterval: 'month' | 'year'
}

export function useSwitchBillingInterval() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ newInterval }: SwitchBillingIntervalParams) => {
      const { data, error } = await supabase.functions.invoke('update-billing-interval', {
        body: { newInterval }
      })

      if (error) {
        throw error
      }

      return data
    },
    onSuccess: (data) => {
      toast({
        title: 'Billing interval updated',
        description: `Your subscription has been switched to ${data.newInterval === 'month' ? 'monthly' : 'annual'} billing.`,
      })
      
      // Invalidate billing status to refetch
      queryClient.invalidateQueries({ queryKey: ['billing-status'] })
    },
    onError: (error: any) => {
      toast({
        title: 'Error updating billing interval',
        description: error.message || 'Failed to update billing interval',
        variant: 'destructive',
      })
    },
  })
}

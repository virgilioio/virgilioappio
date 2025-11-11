import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

interface ChangePlanParams {
  tenantId: string
  newTier: string
  newInterval: string
}

export function useChangePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ tenantId, newTier, newInterval }: ChangePlanParams) => {
      const { data, error } = await supabase.functions.invoke('admin-manage-subscription', {
        body: {
          action: 'change_plan',
          tenantId,
          params: {
            newTier,
            newInterval,
          },
        },
      })

      if (error) {
        console.error('Change plan error:', error)
        throw error
      }

      return data
    },
    onSuccess: (_data, variables) => {
      toast.success('Plan changed successfully', {
        description: `Subscription updated to ${variables.newTier} (${variables.newInterval})`,
      })
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['saas-customer', variables.tenantId] })
      queryClient.invalidateQueries({ queryKey: ['saas-customers'] })
      queryClient.invalidateQueries({ queryKey: ['tenant-subscription', variables.tenantId] })
    },
    onError: (error: Error) => {
      console.error('Change plan mutation error:', error)
      toast.error('Failed to change plan', {
        description: error.message || 'An unexpected error occurred',
      })
    },
  })
}

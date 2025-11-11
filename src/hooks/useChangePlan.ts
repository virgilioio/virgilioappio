import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

interface ChangePlanParams {
  orgId: string
  newTier: string
  newInterval: string
}

export function useChangePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ orgId, newTier, newInterval }: ChangePlanParams) => {
      const { data, error } = await supabase.functions.invoke('admin-change-plan', {
        body: {
          organizationId: orgId,
          newTier,
          newInterval,
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
      queryClient.invalidateQueries({ queryKey: ['saas-customer', variables.orgId] })
      queryClient.invalidateQueries({ queryKey: ['saas-customers'] })
      queryClient.invalidateQueries({ queryKey: ['tenant-subscription'] })
    },
    onError: (error: Error) => {
      console.error('Change plan mutation error:', error)
      toast.error('Failed to change plan', {
        description: error.message || 'An unexpected error occurred',
      })
    },
  })
}

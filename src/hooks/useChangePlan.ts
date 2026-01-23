import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

interface ChangePlanParams {
  tenantId: string
  newInterval: string
  newSeats?: number  // Optional admin override for seat count
}

export function useChangePlan() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ tenantId, newInterval, newSeats }: ChangePlanParams) => {
      const { data, error } = await supabase.functions.invoke('admin-manage-subscription', {
        body: {
          action: 'change_plan',
          tenantId,
          params: {
            newInterval,
            newSeats,
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
      const intervalLabel = variables.newInterval === 'year' ? 'Annual' : 'Monthly'
      const seatsLabel = variables.newSeats ? ` (${variables.newSeats} seats)` : ''
      
      toast.success('Subscription updated successfully', {
        description: `Changed to ${intervalLabel} billing${seatsLabel}`,
      })
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['saas-customer', variables.tenantId] })
      queryClient.invalidateQueries({ queryKey: ['saas-customers'] })
      queryClient.invalidateQueries({ queryKey: ['tenant-subscription', variables.tenantId] })
    },
    onError: (error: Error) => {
      console.error('Change plan mutation error:', error)
      toast.error('Failed to update subscription', {
        description: error.message || 'An unexpected error occurred',
      })
    },
  })
}

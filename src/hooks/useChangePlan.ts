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
      // Get tenant_id from organization
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('tenant_id')
        .eq('id', orgId)
        .single()

      if (orgError) throw orgError
      if (!org?.tenant_id) throw new Error('Organization has no tenant_id')

      const { data, error } = await supabase.functions.invoke('admin-manage-subscription', {
        body: {
          action: 'change_plan',
          tenantId: org.tenant_id,
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

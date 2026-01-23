import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'

interface AssignCreditsParams {
  tenantId: string
  collectCreditsLimit: number
  resetUsage?: boolean
}

export function useAssignTenantCredits() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ tenantId, collectCreditsLimit, resetUsage }: AssignCreditsParams) => {
      const { data, error } = await supabase.functions.invoke('assign-tenant-credits', {
        body: {
          tenant_id: tenantId,
          collect_credits_limit: collectCreditsLimit,
          reset_usage: resetUsage,
        },
      })

      if (error) throw error
      return data
    },
    onSuccess: (data, variables) => {
      toast({
        title: 'Credits Updated',
        description: data.message || 'Credit limits have been successfully updated.',
      })

      console.log('✅ Credits assigned successfully:', data)
      
      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: ['sourcing-credits-usage', variables.tenantId] })
      queryClient.invalidateQueries({ queryKey: ['saas-customer', variables.tenantId] })
      queryClient.invalidateQueries({ queryKey: ['saas-customers'] })
      // Also invalidate end-user credit queries (they use organizationId, but we don't have it here)
      // Using a predicate to match all sourcing-credits queries
      queryClient.invalidateQueries({ 
        predicate: (query) => query.queryKey[0] === 'sourcing-credits' 
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Failed to Update Credits',
        description: error.message || 'An error occurred while updating credit limits.',
        variant: 'destructive',
      })
    },
  })
}

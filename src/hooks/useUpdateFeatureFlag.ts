import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'

export function useUpdateFeatureFlag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ flagName, isActive }: { flagName: string; isActive: boolean }) => {
      const { data, error } = await supabase.rpc('update_feature_flag', {
        flag_name_param: flagName,
        is_active_param: isActive
      })
      
      if (error) {
        throw error
      }
      
      return data
    },
    onSuccess: (_, { flagName, isActive }) => {
      // Invalidate and refetch feature flags
      queryClient.invalidateQueries({ queryKey: ['feature-flags'] })
      
      // Also invalidate the specific feature flag used by useFeatureFlag
      queryClient.invalidateQueries({ queryKey: ['feature-flag', flagName] })
      
      toast({
        title: 'Feature flag updated',
        description: `${flagName} has been ${isActive ? 'enabled' : 'disabled'}`,
      })
    },
    onError: (error) => {
      console.error('Error updating feature flag:', error)
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to update feature flag. Please try again.',
      })
    },
  })
}
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'
import { withAuthRetry } from '@/lib/authUtils'
import { extractErrorMessage } from '@/lib/authUtils'
import { log } from '@/lib/logger'

interface SuspendOrgParams {
  orgId: string
  reason: string
}

interface RestoreOrgParams {
  orgId: string
}

interface ExtendTrialParams {
  orgId: string
  newEndDate: Date
}

export function useSuspendOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ orgId, reason }: SuspendOrgParams) => {
      log.info('Suspending organization:', { orgId, reason })
      
      return withAuthRetry(async () => {
        const { data, error } = await supabase
          .from('organizations')
          .update({
            status: 'suspended',
            suspended_at: new Date().toISOString(),
            suspended_reason: reason,
            updated_at: new Date().toISOString()
          })
          .eq('id', orgId)
          .select()
          .single()

        if (error) throw error
        return data
      })
    },
    onSuccess: (data) => {
      log.info('Organization suspended successfully:', data.id)
      
      queryClient.invalidateQueries({ queryKey: ['saas-customers'] })
      queryClient.invalidateQueries({ queryKey: ['saas-customer', data.id] })
      
      toast({
        title: 'Organization suspended',
        description: `${data.name} has been suspended successfully.`,
      })
    },
    onError: (error) => {
      log.error('Failed to suspend organization:', error)
      toast({
        variant: 'destructive',
        title: 'Suspension failed',
        description: extractErrorMessage(error),
      })
    }
  })
}

export function useRestoreOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ orgId }: RestoreOrgParams) => {
      log.info('Restoring organization:', { orgId })
      
      return withAuthRetry(async () => {
        const { data, error } = await supabase
          .from('organizations')
          .update({
            status: 'active',
            suspended_at: null,
            suspended_reason: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', orgId)
          .select()
          .single()

        if (error) throw error
        return data
      })
    },
    onSuccess: (data) => {
      log.info('Organization restored successfully:', data.id)
      
      queryClient.invalidateQueries({ queryKey: ['saas-customers'] })
      queryClient.invalidateQueries({ queryKey: ['saas-customer', data.id] })
      
      toast({
        title: 'Organization restored',
        description: `${data.name} has been restored successfully.`,
      })
    },
    onError: (error) => {
      log.error('Failed to restore organization:', error)
      toast({
        variant: 'destructive',
        title: 'Restoration failed',
        description: extractErrorMessage(error),
      })
    }
  })
}

export function useExtendTrial() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ orgId, newEndDate }: ExtendTrialParams) => {
      log.info('Extending trial:', { orgId, newEndDate })
      
      return withAuthRetry(async () => {
        const { data, error } = await supabase
          .from('organizations')
          .update({
            trial_end_date: newEndDate.toISOString(),
            status: 'trialing',
            updated_at: new Date().toISOString()
          })
          .eq('id', orgId)
          .select()
          .single()

        if (error) throw error
        return data
      })
    },
    onSuccess: (data) => {
      log.info('Trial extended successfully:', data.id)
      
      queryClient.invalidateQueries({ queryKey: ['saas-customers'] })
      queryClient.invalidateQueries({ queryKey: ['saas-customer', data.id] })
      
      toast({
        title: 'Trial extended',
        description: `Trial period has been extended successfully.`,
      })
    },
    onError: (error) => {
      log.error('Failed to extend trial:', error)
      toast({
        variant: 'destructive',
        title: 'Trial extension failed',
        description: extractErrorMessage(error),
      })
    }
  })
}

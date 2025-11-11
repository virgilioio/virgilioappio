import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'
import { withAuthRetry } from '@/lib/authUtils'
import { extractErrorMessage } from '@/lib/authUtils'
import { log } from '@/lib/logger'

interface SuspendOrgParams {
  tenantId: string
  reason: string
}

interface RestoreOrgParams {
  tenantId: string
}

interface ExtendTrialParams {
  tenantId: string
  newEndDate: Date
}

interface ActivateAccountParams {
  tenantId: string
}

export function useSuspendOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ tenantId, reason }: SuspendOrgParams) => {
      log.info('Suspending organization:', { tenantId, reason })
      
      return withAuthRetry(async () => {
        const { data, error } = await supabase.functions.invoke('admin-manage-subscription', {
          body: {
            action: 'suspend',
            tenantId,
            params: { reason }
          }
        })

        if (error) throw error
        
        return data.data
      })
    },
    onSuccess: (data, variables) => {
      log.info('Organization suspended successfully:', variables.tenantId)
      
      queryClient.invalidateQueries({ queryKey: ['saas-customers'] })
      queryClient.invalidateQueries({ queryKey: ['saas-customer', variables.tenantId] })
      queryClient.invalidateQueries({ queryKey: ['tenant-subscription', variables.tenantId] })
      
      toast({
        title: 'Organization suspended',
        description: 'The subscription has been suspended successfully.',
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
    mutationFn: async ({ tenantId }: RestoreOrgParams) => {
      log.info('Restoring organization:', { tenantId })
      
      return withAuthRetry(async () => {
        const { data, error } = await supabase.functions.invoke('admin-manage-subscription', {
          body: {
            action: 'restore',
            tenantId
          }
        })

        if (error) throw error
        
        return data.data
      })
    },
    onSuccess: (data, variables) => {
      log.info('Organization restored successfully:', variables.tenantId)
      
      queryClient.invalidateQueries({ queryKey: ['saas-customers'] })
      queryClient.invalidateQueries({ queryKey: ['saas-customer', variables.tenantId] })
      queryClient.invalidateQueries({ queryKey: ['tenant-subscription', variables.tenantId] })
      
      toast({
        title: 'Organization restored',
        description: 'The subscription has been restored successfully.',
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
    mutationFn: async ({ tenantId, newEndDate }: ExtendTrialParams) => {
      log.info('Extending trial:', { tenantId, newEndDate })
      
      return withAuthRetry(async () => {
        const { data, error } = await supabase.functions.invoke('admin-manage-subscription', {
          body: {
            action: 'extend_trial',
            tenantId,
            params: { newEndDate: newEndDate.toISOString() }
          }
        })

        if (error) throw error
        
        return data.data
      })
    },
    onSuccess: (data, variables) => {
      log.info('Trial extended successfully:', variables.tenantId)
      
      queryClient.invalidateQueries({ queryKey: ['saas-customers'] })
      queryClient.invalidateQueries({ queryKey: ['saas-customer', variables.tenantId] })
      queryClient.invalidateQueries({ queryKey: ['tenant-subscription', variables.tenantId] })
      
      toast({
        title: 'Trial extended',
        description: `Trial period extended to ${variables.newEndDate.toLocaleDateString()}.`,
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

export function useActivateAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ tenantId }: ActivateAccountParams) => {
      log.info('Activating account:', { tenantId })
      
      return withAuthRetry(async () => {
        const { data, error } = await supabase.functions.invoke('admin-manage-subscription', {
          body: {
            action: 'activate',
            tenantId
          }
        })

        if (error) throw error
        
        return data.data
      })
    },
    onSuccess: (data, variables) => {
      log.info('Account activated successfully:', variables.tenantId)
      
      queryClient.invalidateQueries({ queryKey: ['saas-customers'] })
      queryClient.invalidateQueries({ queryKey: ['saas-customer', variables.tenantId] })
      queryClient.invalidateQueries({ queryKey: ['tenant-subscription', variables.tenantId] })
      
      toast({
        title: 'Account activated',
        description: 'The account has been activated successfully.',
      })
    },
    onError: (error) => {
      log.error('Failed to activate account:', error)
      toast({
        variant: 'destructive',
        title: 'Activation failed',
        description: extractErrorMessage(error),
      })
    }
  })
}

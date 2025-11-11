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

interface ActivateAccountParams {
  orgId: string
}

export function useSuspendOrganization() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ orgId, reason }: SuspendOrgParams) => {
      log.info('Suspending organization:', { orgId, reason })
      
      return withAuthRetry(async () => {
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('tenant_id, name')
          .eq('id', orgId)
          .single()

        if (orgError) throw orgError
        if (!org?.tenant_id) throw new Error('Organization has no tenant_id')

        const { data, error } = await supabase.functions.invoke('admin-manage-subscription', {
          body: {
            action: 'suspend',
            tenantId: org.tenant_id,
            params: { reason }
          }
        })

        if (error) throw error
        
        return { ...data.data, name: org.name, id: orgId }
      })
    },
    onSuccess: (data) => {
      log.info('Organization suspended successfully:', data.id)
      
      queryClient.invalidateQueries({ queryKey: ['saas-customers'] })
      queryClient.invalidateQueries({ queryKey: ['saas-customer', data.id] })
      queryClient.invalidateQueries({ queryKey: ['tenant-subscription'] })
      
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
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('tenant_id, name')
          .eq('id', orgId)
          .single()

        if (orgError) throw orgError
        if (!org?.tenant_id) throw new Error('Organization has no tenant_id')

        const { data, error } = await supabase.functions.invoke('admin-manage-subscription', {
          body: {
            action: 'restore',
            tenantId: org.tenant_id
          }
        })

        if (error) throw error
        
        return { ...data.data, name: org.name, id: orgId }
      })
    },
    onSuccess: (data) => {
      log.info('Organization restored successfully:', data.id)
      
      queryClient.invalidateQueries({ queryKey: ['saas-customers'] })
      queryClient.invalidateQueries({ queryKey: ['saas-customer', data.id] })
      queryClient.invalidateQueries({ queryKey: ['tenant-subscription'] })
      
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
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('tenant_id, name')
          .eq('id', orgId)
          .single()

        if (orgError) throw orgError
        if (!org?.tenant_id) throw new Error('Organization has no tenant_id')

        const { data, error } = await supabase.functions.invoke('admin-manage-subscription', {
          body: {
            action: 'extend_trial',
            tenantId: org.tenant_id,
            params: { newEndDate: newEndDate.toISOString() }
          }
        })

        if (error) throw error
        
        return { ...data.data, name: org.name, id: orgId }
      })
    },
    onSuccess: (data) => {
      log.info('Trial extended successfully:', data.id)
      
      queryClient.invalidateQueries({ queryKey: ['saas-customers'] })
      queryClient.invalidateQueries({ queryKey: ['saas-customer', data.id] })
      queryClient.invalidateQueries({ queryKey: ['tenant-subscription'] })
      
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

export function useActivateAccount() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ orgId }: ActivateAccountParams) => {
      log.info('Activating account:', { orgId })
      
      return withAuthRetry(async () => {
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('tenant_id, name')
          .eq('id', orgId)
          .single()

        if (orgError) throw orgError
        if (!org?.tenant_id) throw new Error('Organization has no tenant_id')

        const { data, error } = await supabase.functions.invoke('admin-manage-subscription', {
          body: {
            action: 'activate',
            tenantId: org.tenant_id
          }
        })

        if (error) throw error
        
        return { ...data.data, name: org.name, id: orgId }
      })
    },
    onSuccess: (data) => {
      log.info('Account activated successfully:', data.id)
      
      queryClient.invalidateQueries({ queryKey: ['saas-customers'] })
      queryClient.invalidateQueries({ queryKey: ['saas-customer', data.id] })
      queryClient.invalidateQueries({ queryKey: ['tenant-subscription'] })
      
      toast({
        title: 'Account activated',
        description: `${data.name} has been activated successfully.`,
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

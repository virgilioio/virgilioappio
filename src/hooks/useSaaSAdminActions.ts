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
        // Step 1: Get tenant_id from organizations
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('tenant_id, name')
          .eq('id', orgId)
          .single()

        if (orgError) throw orgError
        if (!org?.tenant_id) throw new Error('Organization has no tenant_id')

        // Step 2: Update tenant_subscriptions (source of truth for billing)
        const { data, error } = await supabase
          .from('tenant_subscriptions')
          .update({
            billing_status: 'locked',
            suspended_at: new Date().toISOString(),
            suspended_reason: reason,
            updated_at: new Date().toISOString()
          })
          .eq('tenant_id', org.tenant_id)
          .select()
          .single()

        if (error) throw error
        
        return { ...data, name: org.name, id: orgId }
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
        // Step 1: Get tenant_id and current billing status
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('tenant_id, name')
          .eq('id', orgId)
          .single()

        if (orgError) throw orgError
        if (!org?.tenant_id) throw new Error('Organization has no tenant_id')

        // Step 2: Get current subscription to determine proper status to restore to
        const { data: subscription, error: subError } = await supabase
          .from('tenant_subscriptions')
          .select('trial_ends_at, subscription_status')
          .eq('tenant_id', org.tenant_id)
          .single()

        if (subError) throw subError

        // Determine proper billing_status to restore to
        const now = new Date()
        const trialEndsAt = subscription?.trial_ends_at ? new Date(subscription.trial_ends_at) : null
        const isTrialing = trialEndsAt && trialEndsAt > now
        const billingStatus = isTrialing ? 'trialing' : (subscription?.subscription_status || 'active')

        // Step 3: Update tenant_subscriptions (source of truth for billing)
        const { data, error } = await supabase
          .from('tenant_subscriptions')
          .update({
            billing_status: billingStatus,
            suspended_at: null,
            suspended_reason: null,
            updated_at: new Date().toISOString()
          })
          .eq('tenant_id', org.tenant_id)
          .select()
          .single()

        if (error) throw error
        
        return { ...data, name: org.name, id: orgId }
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
        // Step 1: Get tenant_id from organizations
        const { data: org, error: orgError } = await supabase
          .from('organizations')
          .select('tenant_id, name')
          .eq('id', orgId)
          .single()

        if (orgError) throw orgError
        if (!org?.tenant_id) throw new Error('Organization has no tenant_id')

        // Step 2: Update tenant_subscriptions (source of truth for billing)
        const { data, error } = await supabase
          .from('tenant_subscriptions')
          .update({
            trial_ends_at: newEndDate.toISOString(),
            billing_status: 'trialing',
            updated_at: new Date().toISOString()
          })
          .eq('tenant_id', org.tenant_id)
          .select()
          .single()

        if (error) throw error
        
        return { ...data, name: org.name, id: orgId }
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

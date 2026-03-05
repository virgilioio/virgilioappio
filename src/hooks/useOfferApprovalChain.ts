import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'

export interface ApprovalChainStep {
  id: string
  chain_id: string
  approver_user_id: string
  step_order: number
  created_at: string
  approver_name: string
  approver_email: string | null
  approver_role: string | null
}

export interface ApprovalChain {
  id: string
  job_id: string
  organization_id: string
  is_enabled: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  steps: ApprovalChainStep[]
}

export function useOfferApprovalChain(jobId: string) {
  const { user, organizationId } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = ['offer-approval-chain', jobId]

  const { data: chain, isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<ApprovalChain | null> => {
      // Fetch chain
      const { data: chainData, error: chainError } = await supabase
        .from('offer_approval_chains')
        .select('*')
        .eq('job_id', jobId)
        .maybeSingle()

      if (chainError) {
        console.error('Error fetching approval chain:', chainError)
        return null
      }

      if (!chainData) return null

      // Fetch steps
      const { data: stepsData, error: stepsError } = await supabase
        .from('offer_approval_chain_steps')
        .select('*')
        .eq('chain_id', chainData.id)
        .order('step_order', { ascending: true })

      if (stepsError) {
        console.error('Error fetching chain steps:', stepsError)
        return { ...chainData, steps: [] }
      }

      // Fetch profiles for approvers
      const userIds = stepsData?.map(s => s.approver_user_id) || []
      let profilesMap: Record<string, { first_name: string | null; last_name: string | null; email: string | null }> = {}
      let rolesMap: Record<string, string> = {}

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, email')
          .in('user_id', userIds)

        if (profiles) {
          profilesMap = Object.fromEntries(profiles.map(p => [p.user_id, p]))
        }

        // Fetch member roles
        const { data: members } = await supabase
          .from('members')
          .select('user_id, member_role')
          .in('user_id', userIds)
          .eq('organization_id', chainData.organization_id)

        if (members) {
          rolesMap = Object.fromEntries(members.map(m => [m.user_id, m.member_role]))
        }
      }

      const steps: ApprovalChainStep[] = (stepsData || []).map(step => {
        const profile = profilesMap[step.approver_user_id]
        const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
        return {
          ...step,
          approver_name: name || profile?.email || 'Unknown User',
          approver_email: profile?.email || null,
          approver_role: rolesMap[step.approver_user_id] || null,
        }
      })

      return { ...chainData, steps }
    },
    enabled: !!jobId,
  })

  const toggleChainMutation = useMutation({
    mutationFn: async (enabled: boolean) => {
      if (!organizationId || !user) throw new Error('Missing context')

      if (chain) {
        // Update existing
        const { error } = await supabase
          .from('offer_approval_chains')
          .update({ is_enabled: enabled, updated_at: new Date().toISOString() })
          .eq('id', chain.id)
        if (error) throw error
      } else {
        // Create new
        const { error } = await supabase
          .from('offer_approval_chains')
          .insert({
            job_id: jobId,
            organization_id: organizationId,
            is_enabled: enabled,
            created_by: user.id,
          })
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (error) => {
      console.error('Toggle chain error:', error)
      toast({ title: 'Error', description: 'Failed to update approval chain', variant: 'destructive' })
    },
  })

  const addApproverMutation = useMutation({
    mutationFn: async (approverUserId: string) => {
      if (!chain) throw new Error('Chain not found')

      const nextOrder = (chain.steps.length > 0
        ? Math.max(...chain.steps.map(s => s.step_order))
        : 0) + 1

      const { error } = await supabase
        .from('offer_approval_chain_steps')
        .insert({
          chain_id: chain.id,
          approver_user_id: approverUserId,
          step_order: nextOrder,
        })
      if (error) throw error
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      toast({ title: 'Approver added', description: 'Approver added to the chain' })
    },
    onError: (error: any) => {
      console.error('Add approver error:', error)
      const msg = error?.message?.includes('offer_approval_chain_steps_user_unique')
        ? 'This user is already in the approval chain'
        : 'Failed to add approver'
      toast({ title: 'Error', description: msg, variant: 'destructive' })
    },
  })

  const removeApproverMutation = useMutation({
    mutationFn: async (stepId: string) => {
      if (!chain) throw new Error('Chain not found')

      const step = chain.steps.find(s => s.id === stepId)
      if (!step) throw new Error('Step not found')

      // Delete the step
      const { error: deleteError } = await supabase
        .from('offer_approval_chain_steps')
        .delete()
        .eq('id', stepId)
      if (deleteError) throw deleteError

      // Re-order remaining steps
      const remainingSteps = chain.steps
        .filter(s => s.id !== stepId)
        .sort((a, b) => a.step_order - b.step_order)

      for (let i = 0; i < remainingSteps.length; i++) {
        const newOrder = i + 1
        if (remainingSteps[i].step_order !== newOrder) {
          const { error } = await supabase
            .from('offer_approval_chain_steps')
            .update({ step_order: newOrder })
            .eq('id', remainingSteps[i].id)
          if (error) throw error
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
      toast({ title: 'Approver removed', description: 'Approver removed from the chain' })
    },
    onError: (error) => {
      console.error('Remove approver error:', error)
      toast({ title: 'Error', description: 'Failed to remove approver', variant: 'destructive' })
    },
  })

  const reorderStepsMutation = useMutation({
    mutationFn: async (orderedStepIds: string[]) => {
      if (!chain) throw new Error('Chain not found')

      for (let i = 0; i < orderedStepIds.length; i++) {
        const { error } = await supabase
          .from('offer_approval_chain_steps')
          .update({ step_order: i + 1 })
          .eq('id', orderedStepIds[i])
        if (error) throw error
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey })
    },
    onError: (error) => {
      console.error('Reorder error:', error)
      toast({ title: 'Error', description: 'Failed to reorder approvers', variant: 'destructive' })
    },
  })

  return {
    chain,
    isLoading,
    isEnabled: chain?.is_enabled ?? false,
    steps: chain?.steps ?? [],
    toggleChain: (enabled: boolean) => toggleChainMutation.mutate(enabled),
    addApprover: (userId: string) => addApproverMutation.mutate(userId),
    removeApprover: (stepId: string) => removeApproverMutation.mutate(stepId),
    reorderSteps: (orderedIds: string[]) => reorderStepsMutation.mutate(orderedIds),
    isToggling: toggleChainMutation.isPending,
    isAdding: addApproverMutation.isPending,
    isRemoving: removeApproverMutation.isPending,
    isReordering: reorderStepsMutation.isPending,
  }
}

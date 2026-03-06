import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { useOfferApprovalChain } from '@/hooks/useOfferApprovalChain'
import { logActivity } from '@/lib/activityLogger'

export interface ApprovalRequestStep {
  id: string
  request_id: string
  approver_user_id: string
  step_order: number
  status: 'pending' | 'approved' | 'declined' | 'recalled'
  notes: string | null
  decided_at: string | null
  created_at: string
  // Enriched fields
  approver_name: string
  approver_email: string | null
  approver_role: string | null
}

export interface ApprovalRequest {
  id: string
  offer_letter_id: string
  job_id: string
  organization_id: string
  candidate_id: string
  requested_by: string
  status: 'pending' | 'approved' | 'declined' | 'recalled'
  current_step_order: number
  created_at: string
  updated_at: string
  steps: ApprovalRequestStep[]
}

export function useOfferApprovalRequest(offerLetterId?: string, jobId?: string) {
  const { user, organizationId } = useAuth()
  const queryClient = useQueryClient()
  const queryKey = ['offer-approval-request', offerLetterId]

  const { chain, isLoading: chainLoading } = useOfferApprovalChain(jobId || '')

  const { data: approvalRequest, isLoading: requestLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<ApprovalRequest | null> => {
      if (!offerLetterId) return null

      const { data, error } = await supabase
        .from('offer_approval_requests')
        .select('*')
        .eq('offer_letter_id', offerLetterId)
        .in('status', ['pending', 'approved', 'declined', 'recalled'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (error) {
        console.error('Error fetching approval request:', error)
        return null
      }
      if (!data) return null

      // Fetch steps
      const { data: stepsData, error: stepsError } = await supabase
        .from('offer_approval_request_steps')
        .select('*')
        .eq('request_id', data.id)
        .order('step_order', { ascending: true })

      if (stepsError) {
        console.error('Error fetching approval steps:', stepsError)
        return { ...data, steps: [] } as ApprovalRequest
      }

      // Enrich with profile data
      const userIds = (stepsData || []).map(s => s.approver_user_id)
      let profilesMap: Record<string, any> = {}
      let rolesMap: Record<string, string> = {}

      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('user_id, first_name, last_name, email')
          .in('user_id', userIds)

        if (profiles) {
          profilesMap = Object.fromEntries(profiles.map(p => [p.user_id, p]))
        }

        const { data: members } = await supabase
          .from('members')
          .select('user_id, member_role')
          .in('user_id', userIds)
          .eq('organization_id', data.organization_id)

        if (members) {
          rolesMap = Object.fromEntries(members.map(m => [m.user_id, m.member_role]))
        }
      }

      const steps: ApprovalRequestStep[] = (stepsData || []).map(step => {
        const profile = profilesMap[step.approver_user_id]
        const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
        return {
          ...step,
          status: step.status as ApprovalRequestStep['status'],
          approver_name: name || profile?.email || 'Unknown User',
          approver_email: profile?.email || null,
          approver_role: rolesMap[step.approver_user_id] || null,
        }
      })

      return { ...data, status: data.status as ApprovalRequest['status'], steps }
    },
    enabled: !!offerLetterId,
  })

  const requestApprovalMutation = useMutation({
    mutationFn: async ({ offerId, jId, candidateId }: { offerId: string; jId: string; candidateId: string }) => {
      if (!user || !organizationId || !chain || !chain.is_enabled || chain.steps.length === 0) {
        throw new Error('Approval chain not configured or not enabled')
      }

      // Create the request
      const { data: request, error: reqError } = await supabase
        .from('offer_approval_requests')
        .insert({
          offer_letter_id: offerId,
          job_id: jId,
          organization_id: organizationId,
          candidate_id: candidateId,
          requested_by: user.id,
          status: 'pending',
          current_step_order: 1,
        })
        .select()
        .single()

      if (reqError) throw reqError

      // Create steps from the chain
      const stepInserts = chain.steps.map(s => ({
        request_id: request.id,
        approver_user_id: s.approver_user_id,
        step_order: s.step_order,
        status: 'pending',
      }))

      const { error: stepsError } = await supabase
        .from('offer_approval_request_steps')
        .insert(stepInserts)

      if (stepsError) throw stepsError

      // Update offer letter status to pending_approval
      const { error: offerError } = await supabase
        .from('offer_letters')
        .update({ status: 'pending_approval' })
        .eq('id', offerId)

      if (offerError) throw offerError

      return request
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['offer-letters'] })
      queryClient.invalidateQueries({ queryKey: ['pending-activities'] })
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
      window.dispatchEvent(new CustomEvent('refetch-offer-letters'))
      toast({ title: 'Approval requested', description: 'The offer approval process has been initiated.' })
      logActivity({
        activityType: 'approval_requested',
        title: 'Approval requested',
        description: 'Offer approval process initiated',
        entityType: 'candidate',
        entityId: variables.candidateId,
        organizationId: organizationId || undefined,
        metadata: { jobId: variables.jId, offerLetterId: variables.offerId },
      })
    },
    onError: (error) => {
      console.error('Request approval error:', error)
      toast({ title: 'Error', description: 'Failed to request approval', variant: 'destructive' })
    },
  })

  const approveStepMutation = useMutation({
    mutationFn: async ({ stepId, notes }: { stepId: string; notes?: string }) => {
      if (!approvalRequest) throw new Error('No approval request')

      // Update the step
      const { error: stepError } = await supabase
        .from('offer_approval_request_steps')
        .update({
          status: 'approved',
          notes: notes || null,
          decided_at: new Date().toISOString(),
        })
        .eq('id', stepId)

      if (stepError) throw stepError

      const currentStep = approvalRequest.steps.find(s => s.id === stepId)
      if (!currentStep) throw new Error('Step not found')

      const isLastStep = currentStep.step_order >= Math.max(...approvalRequest.steps.map(s => s.step_order))

      if (isLastStep) {
        // All approved → finalize
        const { error: reqError } = await supabase
          .from('offer_approval_requests')
          .update({ status: 'approved', current_step_order: currentStep.step_order })
          .eq('id', approvalRequest.id)
        if (reqError) throw reqError

        const { error: offerError } = await supabase
          .from('offer_letters')
          .update({ status: 'approved' })
          .eq('id', approvalRequest.offer_letter_id)
        if (offerError) throw offerError
      } else {
        // Advance to next step
        const { error: reqError } = await supabase
          .from('offer_approval_requests')
          .update({ current_step_order: currentStep.step_order + 1 })
          .eq('id', approvalRequest.id)
        if (reqError) throw reqError
      }
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['offer-letters'] })
      queryClient.invalidateQueries({ queryKey: ['pending-activities'] })
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
      window.dispatchEvent(new CustomEvent('refetch-offer-letters'))
      toast({ title: 'Approved', description: 'You have approved this offer.' })
      if (approvalRequest) {
        const step = approvalRequest.steps.find(s => s.id === variables.stepId)
        logActivity({
          activityType: 'approval_approved',
          title: 'Approval step approved',
          description: step ? `Step ${step.step_order} approved by ${step.approver_name}` : 'Approval step approved',
          entityType: 'candidate',
          entityId: approvalRequest.candidate_id,
          organizationId: approvalRequest.organization_id,
          metadata: { jobId: approvalRequest.job_id, offerLetterId: approvalRequest.offer_letter_id, stepOrder: step?.step_order, notes: variables.notes },
        })
      }
    },
    onError: (error) => {
      console.error('Approve step error:', error)
      toast({ title: 'Error', description: 'Failed to approve', variant: 'destructive' })
    },
  })

  const declineStepMutation = useMutation({
    mutationFn: async ({ stepId, notes }: { stepId: string; notes: string }) => {
      if (!approvalRequest) throw new Error('No approval request')

      // Update the step
      const { error: stepError } = await supabase
        .from('offer_approval_request_steps')
        .update({
          status: 'declined',
          notes,
          decided_at: new Date().toISOString(),
        })
        .eq('id', stepId)

      if (stepError) throw stepError

      // Mark the entire request as declined
      const { error: reqError } = await supabase
        .from('offer_approval_requests')
        .update({ status: 'declined' })
        .eq('id', approvalRequest.id)
      if (reqError) throw reqError

      // Revert offer to draft
      const { error: offerError } = await supabase
        .from('offer_letters')
        .update({ status: 'draft' })
        .eq('id', approvalRequest.offer_letter_id)
      if (offerError) throw offerError
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['offer-letters'] })
      queryClient.invalidateQueries({ queryKey: ['pending-activities'] })
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
      window.dispatchEvent(new CustomEvent('refetch-offer-letters'))
      toast({ title: 'Declined', description: 'You have declined this offer.' })
      if (approvalRequest) {
        const step = approvalRequest.steps.find(s => s.id === variables.stepId)
        logActivity({
          activityType: 'approval_declined',
          title: 'Approval declined',
          description: step ? `Step ${step.step_order} declined by ${step.approver_name}` : 'Approval declined',
          entityType: 'candidate',
          entityId: approvalRequest.candidate_id,
          organizationId: approvalRequest.organization_id,
          metadata: { jobId: approvalRequest.job_id, offerLetterId: approvalRequest.offer_letter_id, stepOrder: step?.step_order, notes: variables.notes },
        })
      }
    },
    onError: (error) => {
      console.error('Decline step error:', error)
      toast({ title: 'Error', description: 'Failed to decline', variant: 'destructive' })
    },
  })

  const recallApprovalMutation = useMutation({
    mutationFn: async ({ requestId }: { requestId: string }) => {
      if (!approvalRequest) throw new Error('No approval request')

      // Set all pending steps to recalled
      const { error: stepsError } = await supabase
        .from('offer_approval_request_steps')
        .update({ status: 'recalled' })
        .eq('request_id', requestId)
        .eq('status', 'pending')

      if (stepsError) throw stepsError

      // Set the request to recalled
      const { error: reqError } = await supabase
        .from('offer_approval_requests')
        .update({ status: 'recalled' })
        .eq('id', requestId)

      if (reqError) throw reqError

      // Revert offer to draft
      const { error: offerError } = await supabase
        .from('offer_letters')
        .update({ status: 'draft' })
        .eq('id', approvalRequest.offer_letter_id)

      if (offerError) throw offerError
    },
    onSuccess: () => {
      // Optimistically set cache to recalled to prevent transient stale declined banner
      queryClient.setQueryData(queryKey, (old: ApprovalRequest | null | undefined) => {
        if (!old) return old
        return {
          ...old,
          status: 'recalled' as const,
          steps: old.steps.map(s => s.status === 'pending' ? { ...s, status: 'recalled' as const } : s),
        }
      })
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['offer-letters'] })
      queryClient.invalidateQueries({ queryKey: ['pending-activities'] })
      window.dispatchEvent(new CustomEvent('refetch-offer-letters'))
      toast({ title: 'Recalled', description: 'The approval request has been recalled.' })
    },
    onError: (error) => {
      console.error('Recall approval error:', error)
      toast({ title: 'Error', description: 'Failed to recall approval', variant: 'destructive' })
    },
  })

  // Determine if the current user is the active approver
  const activeStep = approvalRequest?.status === 'pending'
    ? approvalRequest.steps.find(s => s.step_order === approvalRequest.current_step_order && s.status === 'pending')
    : null

  const isCurrentUserActiveApprover = activeStep?.approver_user_id === user?.id
  const isCurrentUserRequester = approvalRequest?.requested_by === user?.id

  const isActiveRequest = approvalRequest?.status === 'pending' || approvalRequest?.status === 'approved'

  return {
    approvalRequest,
    isLoading: requestLoading || chainLoading,
    chain,
    chainEnabled: chain?.is_enabled ?? false,
    chainHasSteps: (chain?.steps?.length ?? 0) > 0,
    isActiveRequest,
    activeStep,
    isCurrentUserActiveApprover,
    isCurrentUserRequester,
    requestApproval: (offerId: string, jId: string, candidateId: string) =>
      requestApprovalMutation.mutateAsync({ offerId, jId, candidateId }),
    approveStep: (stepId: string, notes?: string) =>
      approveStepMutation.mutateAsync({ stepId, notes }),
    declineStep: (stepId: string, notes?: string) =>
      declineStepMutation.mutateAsync({ stepId, notes: notes || '' }),
    recallApproval: (requestId: string) =>
      recallApprovalMutation.mutateAsync({ requestId }),
    isRequesting: requestApprovalMutation.isPending,
    isApproving: approveStepMutation.isPending,
    isDeclining: declineStepMutation.isPending,
    isRecalling: recallApprovalMutation.isPending,
  }
}

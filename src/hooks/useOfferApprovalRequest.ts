import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { useOfferApprovalChain } from '@/hooks/useOfferApprovalChain'
import {
  ApprovalCondition,
  ApprovalMode,
  OfferConditionContext,
  resolveCondition,
  deriveRunStatuses,
  RunStepStatus,
} from '@/lib/offerApproval'

export interface ApprovalRequestStep {
  id: string
  request_id: string
  approver_user_id: string
  step_order: number
  status: 'pending' | 'approved' | 'declined' | 'recalled' | 'skipped'
  notes: string | null
  decided_at: string | null
  created_at: string
  condition: ApprovalCondition
  skip_reason: string | null
  runStatus: RunStepStatus
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

/** The database's own words for a refused decision (GOA01–GOA04), else a plain retry line. */
function decisionMessage(error: unknown): string {
  const e = error as { code?: string; message?: string } | null
  if (e?.code && /^GOA0\d$/.test(e.code) && e.message) return e.message
  return 'Something went wrong. Try again.'
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
          .select('user_id, system_role')
          .in('user_id', userIds)
          .eq('organization_id', data.organization_id)

        if (members) {
          rolesMap = Object.fromEntries(members.map(m => [m.user_id, m.system_role]))
        }
      }

      const mode: ApprovalMode = (chain?.mode === 'parallel' ? 'parallel' : 'sequential')
      const withRunStatus = deriveRunStatuses(
        (stepsData || []).map(s => ({ ...s, status: s.status as string, step_order: s.step_order })),
        mode
      )

      const steps: ApprovalRequestStep[] = withRunStatus.map(step => {
        const profile = profilesMap[step.approver_user_id]
        const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ')
        return {
          ...step,
          condition: (((step as any).condition || 'always') as ApprovalCondition),
          skip_reason: ((step as any).skip_reason ?? null) as string | null,
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
    mutationFn: async ({ offerId, jId, candidateId, context }: { offerId: string; jId: string; candidateId: string; context?: OfferConditionContext }) => {
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

      // Snapshot the chain, resolving each condition against this offer ONCE.
      const stepInserts = chain.steps.map(s => {
        const { applies, skipReason } = resolveCondition(s.condition, context || {})
        return {
          request_id: request.id,
          approver_user_id: s.approver_user_id,
          step_order: s.step_order,
          condition: s.condition || 'always',
          status: applies ? 'pending' : 'skipped',
          skip_reason: applies ? null : skipReason,
        }
      })

      const firstActive = stepInserts.find(s => s.status === 'pending')
      if (firstActive) {
        await supabase
          .from('offer_approval_requests')
          .update({ current_step_order: firstActive.step_order })
          .eq('id', request.id)
      }

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
    },
    onError: (error) => {
      console.error('Request approval error:', error)
      toast({ title: 'Error', description: 'Failed to request approval', variant: 'destructive' })
    },
  })

  // One decision, all its effects, in the database (offer_approval_decide):
  // it checks it's the approver's turn, moves the request to the next
  // approver or approves it and the offer, and on a decline sends the offer
  // back to draft. Approvers who aren't recruiters (a hiring manager) can't
  // write the request or the offer themselves.
  const approveStepMutation = useMutation({
    mutationFn: async ({ stepId, notes }: { stepId: string; notes?: string }) => {
      const { error } = await supabase.rpc('offer_approval_decide', { _step_id: stepId, _decision: 'approved', _notes: notes ?? null })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['offer-letters'] })
      queryClient.invalidateQueries({ queryKey: ['pending-activities'] })
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
      window.dispatchEvent(new CustomEvent('refetch-offer-letters'))
      toast({ title: 'Approved', description: 'You have approved this offer.' })
    },
    onError: (error) => {
      console.error('Approve step error:', error)
      toast({ title: "Couldn't approve", description: decisionMessage(error), variant: 'destructive' })
    },
  })

  const declineStepMutation = useMutation({
    mutationFn: async ({ stepId, notes }: { stepId: string; notes: string }) => {
      const { error } = await supabase.rpc('offer_approval_decide', { _step_id: stepId, _decision: 'declined', _notes: notes || null })
      if (error) throw error
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey })
      queryClient.invalidateQueries({ queryKey: ['offer-letters'] })
      queryClient.invalidateQueries({ queryKey: ['pending-activities'] })
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
      window.dispatchEvent(new CustomEvent('refetch-offer-letters'))
      toast({ title: 'Declined', description: 'You have declined this offer.' })
    },
    onError: (error) => {
      console.error('Decline step error:', error)
      toast({ title: "Couldn't decline", description: decisionMessage(error), variant: 'destructive' })
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
      queryClient.invalidateQueries({ queryKey: ['activity-feed'] })
      window.dispatchEvent(new CustomEvent('refetch-offer-letters'))
      toast({ title: 'Recalled', description: 'The approval request has been recalled.' })
    },
    onError: (error) => {
      console.error('Recall approval error:', error)
      toast({ title: 'Error', description: 'Failed to recall approval', variant: 'destructive' })
    },
  })

  // Determine if the current user is the active approver
  const awaitingSteps = approvalRequest?.status === 'pending'
    ? approvalRequest.steps.filter(s => s.runStatus === 'awaiting')
    : []
  const activeStep =
    awaitingSteps.find(s => s.approver_user_id === user?.id) || awaitingSteps[0] || null

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
    awaitingSteps,
    mode: (chain?.mode === 'parallel' ? 'parallel' : 'sequential') as ApprovalMode,
    isCurrentUserActiveApprover,
    isCurrentUserRequester,
    requestApproval: (offerId: string, jId: string, candidateId: string, context?: OfferConditionContext) =>
      requestApprovalMutation.mutateAsync({ offerId, jId, candidateId, context }),
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

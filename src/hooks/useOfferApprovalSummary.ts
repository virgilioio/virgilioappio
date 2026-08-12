import { useMemo } from 'react'
import { useOfferLetters } from '@/hooks/useOfferLetters'
import { useOfferApprovalChain } from '@/hooks/useOfferApprovalChain'
import { useOfferApprovalRequest } from '@/hooks/useOfferApprovalRequest'
import { canMarkHired as canMarkHiredRule, runCounts } from '@/lib/offerApproval'

/**
 * ONE place that answers "where is this offer in its approval chain, and can we
 * hire?". Every surface (banner, sidebar, offer sub-views) reads from here so
 * they can never disagree.
 */
export function useOfferApprovalSummary(candidateId?: string, jobId?: string) {
  const { offerLetters } = useOfferLetters(candidateId)
  const offerLetter = useMemo(
    () => offerLetters.find((ol) => ol.job_id === jobId),
    [offerLetters, jobId]
  )

  const { isEnabled, steps: configuredSteps, mode, rules, isLoading: chainLoading } =
    useOfferApprovalChain(jobId || '')
  const { approvalRequest, isLoading: requestLoading } = useOfferApprovalRequest(
    offerLetter?.id,
    jobId
  )

  const chainConfigured = isEnabled && configuredSteps.length > 0
  const runSteps = approvalRequest?.steps ?? null

  const { approved, total } = runSteps
    ? runCounts(runSteps)
    : { approved: 0, total: chainConfigured ? configuredSteps.length : 0 }

  const awaitingStep = runSteps?.find((s) => s.runStatus === 'awaiting') || null
  const declinedStep = runSteps?.find((s) => s.runStatus === 'declined') || null
  const skippedCount = (runSteps || []).filter((s) => s.status === 'skipped').length

  const canMarkHired = canMarkHiredRule({
    offerExists: !!offerLetter,
    required: isEnabled,
    approverCount: configuredSteps.length,
    runSteps,
  })

  const gated = !!offerLetter && chainConfigured && !canMarkHired

  return {
    isLoading: chainLoading || requestLoading,
    offerLetter,
    offerExists: !!offerLetter,
    chainConfigured,
    mode,
    rules,
    configuredSteps,
    approvalRequest,
    runSteps,
    approved,
    total,
    awaitingStep,
    declinedStep,
    skippedCount,
    waitingOnName: awaitingStep?.approver_name || null,
    canMarkHired,
    gated,
  }
}

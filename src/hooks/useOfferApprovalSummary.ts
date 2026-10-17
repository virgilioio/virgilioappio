import { useMemo } from 'react'
import { useOfferLetters } from '@/hooks/useOfferLetters'
import { useOfferApprovalChain } from '@/hooks/useOfferApprovalChain'
import { useOfferApprovalRequest } from '@/hooks/useOfferApprovalRequest'
import { canMarkHired as canMarkHiredRule, runCounts } from '@/lib/offerApproval'
import { SIGN_SENDING_LIVE, useOfferGate, useRecordEnvelopes, type OfferGate } from '@/lib/sign/send'
import type { EnvelopeRow } from '@/lib/sign/api'

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

  // Gio Sign (2026-10-17): the database's send rule, and the envelope this
  // offer went out as (if any). Hiring waits for a sent offer to be signed.
  const gateQ = useOfferGate(SIGN_SENDING_LIVE ? offerLetter?.id : null)
  const gate: OfferGate | null = gateQ.data ?? null
  const envQ = useRecordEnvelopes(SIGN_SENDING_LIVE && candidateId && jobId ? { type: 'candidate', id: candidateId, jobId } : null)
  const offerEnvelope: EnvelopeRow | null = useMemo(() => {
    if (!offerLetter) return null
    const mine = (envQ.data ?? []).filter((e) => e.offer_id === offerLetter.id && e.status !== 'draft')
    return mine.find((e) => e.status === 'completed') ?? mine.find((e) => ['sent', 'queued', 'scheduled'].includes(e.status)) ?? mine[0] ?? null
  }, [envQ.data, offerLetter])
  const signed = offerEnvelope?.status === 'completed'
  const outForSignature = !!offerEnvelope && ['sent', 'queued', 'scheduled'].includes(offerEnvelope.status)

  const approvalsClear = canMarkHiredRule({
    offerExists: !!offerLetter,
    required: isEnabled,
    approverCount: configuredSteps.length,
    runSteps,
  })
  // Once an offer is out for signature, hiring waits for everyone to sign.
  const canMarkHired = approvalsClear && (!offerEnvelope || signed || ['voided', 'expired', 'cancelled', 'declined'].includes(offerEnvelope.status))

  const gated = !!offerLetter && chainConfigured && !approvalsClear
  const canSend = !!gate?.ok

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
    /** Whether the offer can go out for signature right now (offer_can_send). */
    canSend,
    gate,
    gateLoading: gateQ.isLoading,
    /** The envelope this offer was sent as, if any. */
    offerEnvelope,
    outForSignature,
    signed,
  }
}

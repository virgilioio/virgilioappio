import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Check, X, Clock, Send, Loader2 } from 'lucide-react'
import { useOfferApprovalRequest } from '@/hooks/useOfferApprovalRequest'
import { useOfferLetters } from '@/hooks/useOfferLetters'
import { useOfferApprovalChain } from '@/hooks/useOfferApprovalChain'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface CandidateOfferApprovalsProps {
  candidateId: string
  jobId: string
  organizationId?: string | null
  candidateFirstName?: string
}

const roleLabelMap: Record<string, string> = {
  admin: 'Admin',
  recruiter: 'Recruiter',
  hiring_manager: 'Hiring Manager',
  interviewer: 'Interviewer',
}

type RowState = 'approved' | 'active' | 'waiting' | 'declined' | 'recalled'

function NumberedCircle({ state, index }: { state: RowState; index: number }) {
  const base = 'h-7 w-7 rounded-full flex items-center justify-center font-poppins font-semibold text-[11.5px]'
  if (state === 'approved') {
    return (
      <div className={cn(base)} style={{ backgroundColor: '#DCFCE7', color: '#0B6E4F' }}>
        <Check className="h-3.5 w-3.5" />
      </div>
    )
  }
  if (state === 'declined') {
    return (
      <div className={cn(base)} style={{ backgroundColor: '#FEE2E2', color: '#B91C1C' }}>
        <X className="h-3.5 w-3.5" />
      </div>
    )
  }
  if (state === 'active') {
    return (
      <div className={cn(base, 'ring-2 ring-virgilio-purple/30')} style={{ backgroundColor: '#EDE4FF', color: '#5B2BD9' }}>
        {index}
      </div>
    )
  }
  return (
    <div className={cn(base)} style={{ backgroundColor: '#F1F0EC', color: '#8B8F9E' }}>
      {index}
    </div>
  )
}

function StatusDotChip({ state }: { state: RowState }) {
  const map: Record<RowState, { label: string; color: string; bg: string }> = {
    approved: { label: 'Approved', color: '#0B6E4F', bg: '#DCFCE7' },
    active: { label: 'Pending', color: '#5B2BD9', bg: '#EDE4FF' },
    waiting: { label: 'Waiting', color: '#8B8F9E', bg: '#F1F0EC' },
    declined: { label: 'Declined', color: '#B91C1C', bg: '#FEE2E2' },
    recalled: { label: 'Recalled', color: '#8B8F9E', bg: '#F1F0EC' },
  }
  const t = map[state]
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 font-inter" style={{ fontSize: 11, backgroundColor: t.bg, color: t.color }}>
      <span className="inline-block rounded-full" style={{ width: 5, height: 5, backgroundColor: 'currentColor' }} />
      {t.label}
    </span>
  )
}

export function CandidateOfferApprovals({ candidateId, jobId, organizationId, candidateFirstName }: CandidateOfferApprovalsProps) {
  const { offerLetters } = useOfferLetters(candidateId)
  const offerLetter = offerLetters.find(ol => ol.job_id === jobId)
  const { approvalRequest, isLoading, isCurrentUserActiveApprover, activeStep, approveStep, declineStep, isApproving, isDeclining } = useOfferApprovalRequest(offerLetter?.id, jobId)
  const { steps: configuredSteps, isEnabled: chainEnabled } = useOfferApprovalChain(jobId)

  const [declineNotes, setDeclineNotes] = useState('')
  const [showDeclineForm, setShowDeclineForm] = useState(false)

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-body-sm text-text-secondary text-center">Loading approval status…</div>
        </CardContent>
      </Card>
    )
  }

  // Draft state — show chain config with all rows Waiting
  if (!approvalRequest) {
    if (!chainEnabled || configuredSteps.length === 0) {
      return (
        <Card>
          <CardContent className="py-12">
            <p className="text-body-sm text-text-secondary text-center">No approval chain configured for this job.</p>
          </CardContent>
        </Card>
      )
    }
    const sorted = [...configuredSteps].sort((a, b) => a.step_order - b.step_order)
    return (
      <Card>
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-poppins font-semibold text-[14px] text-text-primary">Approval chain</h3>
            <span className="font-inter text-[11.5px] uppercase tracking-[0.08em] text-[#8B8F9E]">{sorted.length} steps</span>
          </div>
          <div className="space-y-3.5">
            {sorted.map((step, i) => (
              <div key={step.id} className="flex items-center gap-3">
                <NumberedCircle state="waiting" index={i + 1} />
                <div className="flex-1 min-w-0">
                  <p className="font-poppins font-medium text-[13px] text-text-primary truncate">{step.approver_name}</p>
                  <p className="font-inter text-[11.5px] text-[#8B8F9E]">{roleLabelMap[step.approver_role] || 'Approver'}</p>
                </div>
                <StatusDotChip state="waiting" />
              </div>
            ))}
          </div>
          <p className="mt-4 font-inter text-[12px] text-[#8B8F9E]">
            Approvals start when you submit the offer.
          </p>
        </CardContent>
      </Card>
    )
  }

  const steps = approvalRequest.steps
  const approvedCount = steps.filter(s => s.status === 'approved').length
  const total = steps.length
  const allApproved = approvalRequest.status === 'approved'

  const handleApprove = async () => {
    if (!activeStep) return
    await approveStep(activeStep.id)
  }
  const handleDecline = async () => {
    if (!activeStep) return
    await declineStep(activeStep.id, declineNotes.trim() || undefined)
    setShowDeclineForm(false)
    setDeclineNotes('')
  }

  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-poppins font-semibold text-[14px] text-text-primary">Approval chain</h3>
          <span
            className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-inter"
            style={{
              fontSize: 11.5,
              backgroundColor: allApproved ? '#DCFCE7' : '#EDE4FF',
              color: allApproved ? '#0B6E4F' : '#5B2BD9',
            }}
          >
            <Check className="h-3 w-3" />
            Approved {approvedCount} of {total}
          </span>
        </div>

        <div className="space-y-3.5">
          {steps.map((step, i) => {
            const isActive = approvalRequest.status === 'pending' && step.step_order === approvalRequest.current_step_order && step.status === 'pending'
            const isApproved = step.status === 'approved'
            const isDeclined = step.status === 'declined'
            const isRecalled = step.status === 'recalled'
            const state: RowState = isApproved ? 'approved' : isDeclined ? 'declined' : isRecalled ? 'recalled' : isActive ? 'active' : 'waiting'

            return (
              <div key={step.id}>
                <div className="flex items-center gap-3">
                  <NumberedCircle state={state} index={i + 1} />
                  <div className="flex-1 min-w-0">
                    <p className="font-poppins font-medium text-[13px] text-text-primary truncate">{step.approver_name}</p>
                    <p className="font-inter text-[11.5px] text-[#8B8F9E] truncate">
                      {roleLabelMap[step.approver_role] || 'Approver'}
                      {step.decided_at && <> · {isApproved ? 'Approved' : 'Declined'} {formatDistanceToNow(new Date(step.decided_at), { addSuffix: true })}</>}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusDotChip state={state} />
                    {isActive && !isCurrentUserActiveApprover && (
                      <Button
                        variant="ghost"
                        size="xs"
                        icon={Send}
                        onClick={() => toast.success(`Reminder sent to ${step.approver_name}`)}
                      >
                        Send reminder
                      </Button>
                    )}
                  </div>
                </div>

                {(isApproved || isDeclined) && step.notes && (
                  <div className="ml-10 mt-2 rounded-lg px-3 py-2" style={{ backgroundColor: isDeclined ? '#FBF1F0' : '#FAFAF7', border: `1px solid ${isDeclined ? '#F3D9D6' : '#F1F0EC'}` }}>
                    <p className="font-inter text-[12px] text-text-primary whitespace-pre-wrap">{step.notes}</p>
                  </div>
                )}

                {isActive && isCurrentUserActiveApprover && (
                  <div className="ml-10 mt-3">
                    {!showDeclineForm ? (
                      <div className="flex gap-2">
                        <Button size="sm" variant="primary" icon={Check} onClick={handleApprove} disabled={isApproving || isDeclining} loading={isApproving}>
                          Approve
                        </Button>
                        <Button size="sm" variant="danger" icon={X} onClick={() => setShowDeclineForm(true)} disabled={isApproving || isDeclining}>
                          Decline
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Textarea placeholder="Please provide a reason for declining…" value={declineNotes} onChange={(e) => setDeclineNotes(e.target.value)} rows={3} className="text-sm" />
                        <div className="flex gap-2">
                          <Button size="sm" variant="dangerSolid" icon={isDeclining ? Loader2 : X} onClick={handleDecline} disabled={isDeclining} loading={isDeclining}>
                            Confirm Decline
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => { setShowDeclineForm(false); setDeclineNotes('') }}>
                            Cancel
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}

          {/* Terminal sent row */}
          {allApproved && (
            <div className="flex items-center gap-3 pt-1">
              <div className="h-7 w-7 rounded-full flex items-center justify-center" style={{ backgroundColor: '#0d0d09', color: '#fffcf9' }}>
                <Send className="h-3.5 w-3.5" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-poppins font-medium text-[13px] text-text-primary">
                  Offer sent to {candidateFirstName || 'candidate'}
                </p>
                <p className="font-inter text-[11.5px] text-[#8B8F9E]">All approvals complete</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

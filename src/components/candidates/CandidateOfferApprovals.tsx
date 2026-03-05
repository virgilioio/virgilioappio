import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Check, X, Clock, AlertCircle, Loader2 } from 'lucide-react'
import { useOfferApprovalRequest } from '@/hooks/useOfferApprovalRequest'
import { useOfferLetters } from '@/hooks/useOfferLetters'
import { useOfferApprovalChain } from '@/hooks/useOfferApprovalChain'
import { formatDistanceToNow } from 'date-fns'
import { cn } from '@/lib/utils'
import gioFaceEmpty from '@/assets/gio-face-empty.png'

interface CandidateOfferApprovalsProps {
  candidateId: string
  jobId: string
  organizationId?: string | null
}

const roleLabelMap: Record<string, string> = {
  admin: 'Admin',
  recruiter: 'Recruiter',
  hiring_manager: 'Hiring Manager',
  interviewer: 'Interviewer',
}

export function CandidateOfferApprovals({ candidateId, jobId, organizationId }: CandidateOfferApprovalsProps) {
  const { offerLetters } = useOfferLetters(candidateId)
  const offerLetter = offerLetters.find(ol => ol.job_id === jobId)
  const { approvalRequest, isLoading, isCurrentUserActiveApprover, activeStep, approveStep, declineStep, isApproving, isDeclining } = useOfferApprovalRequest(offerLetter?.id, jobId)
  const { steps: configuredSteps, isEnabled: chainEnabled, isLoading: chainLoading } = useOfferApprovalChain(jobId)
  
  const [declineNotes, setDeclineNotes] = useState('')
  const [showDeclineForm, setShowDeclineForm] = useState(false)

  if (isLoading) {
    return (
      <Card className="bg-surface-primary border-border">
        <CardContent className="py-8">
          <div className="text-sm text-text-secondary text-center">Loading approval status...</div>
        </CardContent>
      </Card>
    )
  }

  if (!approvalRequest) {
    const hasConfiguredChain = chainEnabled && configuredSteps.length > 0

    return (
      <Card className="bg-surface-primary border-border">
        <CardContent className="py-12">
          <div className="text-center">
            <img 
              src={gioFaceEmpty}
              alt="No approval request"
              className="h-16 w-16 mx-auto mb-4 rounded-full"
            />
            <p className="text-[1.38rem] font-semibold mb-2 tracking-[-0.06em]">
              <span>No approval request yet</span>
              <span className="text-purple-period">.</span>
            </p>
            <p className="text-sm text-text-secondary">
              Request approval from the Offer Details tab to start the approval chain.
            </p>
          </div>

          {hasConfiguredChain && (
            <div className="mt-8 mx-auto max-w-sm">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Steps</div>
              <div className="relative">
                <div className="absolute left-[14px] top-0 bottom-0 w-0.5 bg-border" />
                {configuredSteps
                  .sort((a, b) => a.step_order - b.step_order)
                  .map((step, index) => {
                    const isLast = index === configuredSteps.length - 1
                    return (
                      <div key={step.id} className="relative flex gap-2.5">
                        <div className="relative z-10 flex-shrink-0">
                          <div className="h-[30px] w-[30px] rounded-full border-2 border-border bg-surface-primary flex items-center justify-center">
                            <span className="text-xs font-semibold text-muted-foreground">{index + 1}</span>
                          </div>
                        </div>
                        <div className={cn("flex-1 pt-0.5", isLast ? "pb-0" : "pb-7")}>
                          <span className="text-sm font-semibold text-text-primary">
                            {step.approver_name}
                          </span>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {roleLabelMap[step.approver_role] || 'Approval'}
                          </div>
                        </div>
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  const handleApprove = async () => {
    if (!activeStep) return
    await approveStep(activeStep.id)
  }

  const handleDecline = async () => {
    if (!activeStep || !declineNotes.trim()) return
    await declineStep(activeStep.id, declineNotes.trim())
    setShowDeclineForm(false)
    setDeclineNotes('')
  }

  return (
    <Card className="bg-surface-primary border-border">
      <CardContent className="pt-6 pb-4">
        {/* Overall status */}
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-sm font-semibold text-text-primary">Approval Chain</h3>
          <Badge
            variant={
              approvalRequest.status === 'approved' ? 'default' :
              approvalRequest.status === 'declined' ? 'destructive' :
              'secondary'
            }
            className="capitalize"
          >
            {approvalRequest.status === 'pending' ? 'In Progress' : approvalRequest.status}
          </Badge>
        </div>

        {/* Timeline */}
        <div className="relative space-y-0">
          {approvalRequest.steps.map((step, index) => {
            const isActive = approvalRequest.status === 'pending' && step.step_order === approvalRequest.current_step_order && step.status === 'pending'
            const isApprovedStep = step.status === 'approved'
            const isDeclinedStep = step.status === 'declined'
            const isPending = step.status === 'pending' && !isActive
            const isLast = index === approvalRequest.steps.length - 1

            return (
              <div key={step.id} className="relative flex gap-3">
                {/* Vertical line */}
                {!isLast && (
                  <div className="absolute left-[13px] top-7 bottom-0 w-px bg-border" />
                )}

                {/* Status icon */}
                <div className="relative z-10 flex-shrink-0 mt-0.5">
                  {isApprovedStep && (
                    <div className="h-7 w-7 rounded-full bg-green-500/15 flex items-center justify-center">
                      <Check className="h-3.5 w-3.5 text-green-600" />
                    </div>
                  )}
                  {isDeclinedStep && (
                    <div className="h-7 w-7 rounded-full bg-destructive/15 flex items-center justify-center">
                      <X className="h-3.5 w-3.5 text-destructive" />
                    </div>
                  )}
                  {isActive && (
                    <div className="h-7 w-7 rounded-full bg-virgilio-purple/15 flex items-center justify-center ring-2 ring-virgilio-purple/30">
                      <AlertCircle className="h-3.5 w-3.5 text-virgilio-purple" />
                    </div>
                  )}
                  {isPending && (
                    <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Content */}
                <div className={cn("flex-1 pb-6", isLast && "pb-0")}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-text-primary">
                      {step.approver_name}
                    </span>
                    {step.approver_role && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {roleLabelMap[step.approver_role] || step.approver_role}
                      </Badge>
                    )}
                  </div>

                  <div className="text-xs text-muted-foreground mt-0.5">
                    Step {step.step_order}
                    {step.decided_at && (
                      <> · {isApprovedStep ? 'Approved' : 'Declined'} {formatDistanceToNow(new Date(step.decided_at), { addSuffix: true })}</>
                    )}
                    {isActive && ' · Awaiting decision'}
                    {isPending && ' · Pending'}
                  </div>

                  {/* Decline notes */}
                  {isDeclinedStep && step.notes && (
                    <div className="mt-2 p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                      <p className="text-xs font-medium text-destructive mb-1">Reason for declining:</p>
                      <p className="text-sm text-text-secondary">{step.notes}</p>
                    </div>
                  )}

                  {/* Approval notes */}
                  {isApprovedStep && step.notes && (
                    <div className="mt-2 p-3 bg-green-500/5 border border-green-500/20 rounded-lg">
                      <p className="text-xs font-medium text-green-600 mb-1">Notes:</p>
                      <p className="text-sm text-text-secondary">{step.notes}</p>
                    </div>
                  )}

                  {/* Action buttons for active approver */}
                  {isActive && isCurrentUserActiveApprover && (
                    <div className="mt-3 space-y-3">
                      {!showDeclineForm ? (
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            onClick={handleApprove}
                            disabled={isApproving || isDeclining}
                          >
                            {isApproving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setShowDeclineForm(true)}
                            disabled={isApproving || isDeclining}
                          >
                            <X className="h-3.5 w-3.5 mr-1.5" />
                            Decline
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          <Textarea
                            placeholder="Please provide a reason for declining..."
                            value={declineNotes}
                            onChange={(e) => setDeclineNotes(e.target.value)}
                            rows={3}
                            className="text-sm"
                          />
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={handleDecline}
                              disabled={!declineNotes.trim() || isDeclining}
                            >
                              {isDeclining ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <X className="h-3.5 w-3.5 mr-1.5" />}
                              Confirm Decline
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => { setShowDeclineForm(false); setDeclineNotes('') }}
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

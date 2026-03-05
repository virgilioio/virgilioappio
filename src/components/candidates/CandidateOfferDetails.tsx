import { useState, useEffect, useCallback } from 'react'
import { useOfferLetters } from '@/hooks/useOfferLetters'
import { useOfferFormFields } from '@/hooks/useOfferFormFields'
import { useRecruiterOptions } from '@/hooks/useRecruiterOptions'
import { useOfferApprovalRequest } from '@/hooks/useOfferApprovalRequest'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Loader2, Send, Clock, Pencil, Undo2, Check, X, FileText, MoreHorizontal } from 'lucide-react'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import gioFaceEmpty from '@/assets/gio-face-empty.png'
import { GenerateOfferDialog } from './GenerateOfferDialog'
import { MinimizableEmailComposer } from './MinimizableEmailComposer'
import { supabase } from '@/lib/supabaseClient'

const employmentTypeLabels: Record<string, string> = {
  full_time: 'Full-time', part_time: 'Part-time',
  temporary: 'Temporary', internship: 'Internship'
}
const workLocationLabels: Record<string, string> = {
  remote: 'Remote', hybrid: 'Hybrid', onsite: 'On-site'
}

interface CandidateOfferDetailsProps {
  candidateId: string
  jobId: string
  organizationId?: string | null
  candidate?: any
  job?: any
  organization?: any
  onEdit?: (offer: { id: string; form_id: string; field_values: Record<string, any> }) => void
  associationStatus?: string | null
}

function formatLocationValue(value: any): string {
  if (!value) return '—'
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch { return value }
  }
  const parts = [value.city, value.state, value.country].filter(Boolean)
  return parts.length > 0 ? parts.join(', ') : '—'
}

function formatSalaryValue(value: any, config?: any): string {
  if (!value) return '—'
  if (typeof value === 'string') {
    try { value = JSON.parse(value) } catch { return value }
  }
  const amount = value.amount || value
  const currency = value.currency || config?.default_currency || 'USD'
  const period = value.period || config?.default_period || 'yearly'
  if (typeof amount === 'number' || !isNaN(Number(amount))) {
    return `${currency} ${Number(amount).toLocaleString()} / ${period}`
  }
  return String(amount)
}

function getStatusVariant(status: string) {
  switch (status) {
    case 'draft': return 'secondary'
    case 'pending_approval': return 'purple'
    case 'approved': return 'purple'
    case 'finalized': return 'default'
    case 'sent': return 'default'
    case 'accepted': return 'default'
    case 'declined': return 'destructive'
    default: return 'secondary'
  }
}

function getStatusLabel(status: string) {
  if (status === 'pending_approval') return 'Pending Approval'
  if (status === 'approved') return 'Approved'
  return status
}

export function CandidateOfferDetails({ candidateId, jobId, organizationId, candidate, job, organization, onEdit, associationStatus }: CandidateOfferDetailsProps) {
  const { offerLetters, isLoading } = useOfferLetters(candidateId)
  const { data: recruiterOptions = [] } = useRecruiterOptions(organizationId || null)
  
  // Find the offer letter for this job
  const offerLetter = offerLetters.find(ol => ol.job_id === jobId)
  const { fields } = useOfferFormFields(offerLetter?.form_id || undefined)
  const { approvalRequest, isActiveRequest, chainEnabled, chainHasSteps, requestApproval, isRequesting, recallApproval, isRecalling, isCurrentUserRequester, isCurrentUserActiveApprover, activeStep, approveStep, declineStep, isApproving, isDeclining } = useOfferApprovalRequest(offerLetter?.id, jobId)

  const [approveComment, setApproveComment] = useState('')
  const [declineComment, setDeclineComment] = useState('')
  const [showApproveForm, setShowApproveForm] = useState(false)
  const [showDeclineForm, setShowDeclineForm] = useState(false)
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [offerDocument, setOfferDocument] = useState<{ id: string; file_name: string; file_path: string } | null>(null)
  const [showEmailComposer, setShowEmailComposer] = useState(false)

  const checkOfferDocument = useCallback(async () => {
    if (!candidateId) return
    const { data } = await supabase
      .from('candidate_attachments')
      .select('id, file_name, file_url')
      .eq('candidate_id', candidateId)
      .ilike('file_name', 'Offer Letter%')
      .limit(1)
    if (data && data.length > 0) {
      setOfferDocument({ id: data[0].id, file_name: data[0].file_name, file_path: data[0].file_url })
    } else {
      setOfferDocument(null)
    }
  }, [candidateId])

  useEffect(() => {
    checkOfferDocument()
    const handler = () => checkOfferDocument()
    window.addEventListener('refetch-attachments', handler)
    return () => window.removeEventListener('refetch-attachments', handler)
  }, [checkOfferDocument])

  if (isLoading) {
    return (
      <Card className="bg-surface-primary border-border">
        <CardContent className="py-8">
          <div className="text-sm text-text-secondary text-center">Loading offer details...</div>
        </CardContent>
      </Card>
    )
  }

  if (!offerLetter) {
    return (
      <Card className="bg-surface-primary border-border">
        <CardContent className="py-12">
          <div className="text-center">
            <img 
              src={gioFaceEmpty}
              alt="No offer details"
              className="h-16 w-16 mx-auto mb-4 rounded-full"
            />
            <p className="text-[1.38rem] font-semibold mb-2 tracking-[-0.06em]">
              <span>No offer details yet</span>
              <span className="text-purple-period">.</span>
            </p>
            <p className="text-sm text-text-secondary">
              Create an offer using the Offer Form to see details here.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const fieldValues = offerLetter.field_values || {}

  const handleApprove = async () => {
    if (!activeStep) return
    await approveStep(activeStep.id, approveComment.trim() || undefined)
    setShowApproveForm(false)
    setApproveComment('')
  }

  const handleDecline = async () => {
    if (!activeStep) return
    await declineStep(activeStep.id, declineComment.trim() || undefined)
    setShowDeclineForm(false)
    setDeclineComment('')
  }

  return (
    <>
    <Card className="bg-surface-primary border-border">
      {/* Approval status banner */}
      {(approvalRequest?.status === 'approved' || offerDocument) && (
        <div className="mx-6 mt-6 space-y-3">
          {approvalRequest?.status === 'approved' && (
            <div className="p-3 rounded-lg bg-virgilio-purple/10 border border-virgilio-purple/20">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-virgilio-purple" />
                <span className="text-sm font-medium text-virgilio-purple">This offer has been approved</span>
              </div>
            </div>
          )}
          {offerDocument && (
            <div
              onClick={async () => {
                const { data } = await supabase.storage
                  .from('candidate-attachments')
                  .createSignedUrl(offerDocument.file_path, 300)
                if (data?.signedUrl) window.open(data.signedUrl, '_blank')
              }}
              className="p-3 rounded-lg bg-pastel-yellow/30 border border-pastel-yellow cursor-pointer hover:bg-pastel-yellow/40 transition-colors"
            >
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-pastel-yellow-foreground" />
                <div>
                  <span className="text-sm font-medium text-pastel-yellow-foreground">Offer document generated</span>
                  <p className="text-xs text-pastel-yellow-foreground/80">{offerDocument.file_name}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
      {approvalRequest?.status === 'declined' && (
        <div className="mx-6 mt-6 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
          <div className="flex items-center gap-2">
            <X className="h-4 w-4 text-destructive" />
            <div>
              <span className="text-sm font-medium text-destructive">This offer has been declined</span>
              {approvalRequest.steps.find(s => s.status === 'declined')?.notes && (
                <p className="text-xs text-destructive/80 mt-1">
                  {approvalRequest.steps.find(s => s.status === 'declined')?.notes}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Offer Details</CardTitle>
          <div className="flex items-center gap-2">
            {associationStatus !== 'hired' && onEdit && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onEdit({
                  id: offerLetter.id,
                  form_id: offerLetter.form_id || '',
                  field_values: offerLetter.field_values || {},
                })}
              >
                <Pencil className="h-3.5 w-3.5 mr-1.5" />
                Edit
              </Button>
            )}
            {(() => {
              const overflowActions: { label: string; icon: React.ElementType; onClick: () => void; disabled?: boolean }[] = []

              if (offerLetter.status === 'pending_approval' && isCurrentUserActiveApprover && !showApproveForm && !showDeclineForm) {
                overflowActions.push(
                  { label: 'Approve', icon: Check, onClick: () => setShowApproveForm(true), disabled: isApproving || isDeclining },
                  { label: 'Decline', icon: X, onClick: () => setShowDeclineForm(true), disabled: isApproving || isDeclining },
                )
              }
              if (offerLetter.status === 'approved' && approvalRequest?.status === 'approved') {
                overflowActions.push({ label: 'Generate Offer Letter', icon: FileText, onClick: () => setShowGenerateDialog(true) })
              }
              if (offerLetter.status === 'approved' && !!offerDocument) {
                overflowActions.push({ label: 'Send Offer', icon: Send, onClick: () => setShowEmailComposer(true) })
              }
              if (offerLetter.status === 'draft' && chainEnabled && chainHasSteps && !isActiveRequest) {
                overflowActions.push({ label: 'Request Approval', icon: Send, onClick: () => requestApproval(offerLetter.id, jobId, candidateId), disabled: isRequesting })
              }
              if (offerLetter.status === 'pending_approval' && isCurrentUserRequester && approvalRequest) {
                overflowActions.push({ label: 'Recall', icon: Undo2, onClick: () => recallApproval(approvalRequest.id), disabled: isRecalling })
              }

              if (overflowActions.length === 0) return null

              return (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {overflowActions.map((action) => {
                      const Icon = action.icon
                      return (
                        <DropdownMenuItem key={action.label} onClick={action.onClick} disabled={action.disabled}>
                          <Icon className="h-3.5 w-3.5 mr-2" />
                          {action.label}
                        </DropdownMenuItem>
                      )
                    })}
                  </DropdownMenuContent>
                </DropdownMenu>
              )
            })()}
            <Badge variant={getStatusVariant(offerLetter.status) as any} className="capitalize">
              {getStatusLabel(offerLetter.status)}
            </Badge>
          </div>
        </div>
      </CardHeader>

      {/* Inline approve form */}
      {showApproveForm && (
        <div className="mx-6 mb-4 p-4 rounded-lg border border-border bg-surface-secondary space-y-3">
          <p className="text-sm font-medium text-text-primary">Approve this offer</p>
          <Textarea
            placeholder="Add a comment (optional)..."
            value={approveComment}
            onChange={(e) => setApproveComment(e.target.value)}
            rows={2}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleApprove} disabled={isApproving}>
              {isApproving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Check className="h-3.5 w-3.5 mr-1.5" />}
              Confirm Approve
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowApproveForm(false); setApproveComment('') }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Inline decline form */}
      {showDeclineForm && (
        <div className="mx-6 mb-4 p-4 rounded-lg border border-destructive/20 bg-destructive/5 space-y-3">
          <p className="text-sm font-medium text-destructive">Decline this offer</p>
          <Textarea
            placeholder="Add a reason (optional)..."
            value={declineComment}
            onChange={(e) => setDeclineComment(e.target.value)}
            rows={2}
            className="text-sm"
          />
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" onClick={handleDecline} disabled={isDeclining}>
              {isDeclining ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <X className="h-3.5 w-3.5 mr-1.5" />}
              Confirm Decline
            </Button>
            <Button size="sm" variant="ghost" onClick={() => { setShowDeclineForm(false); setDeclineComment('') }}>
              Cancel
            </Button>
          </div>
        </div>
      )}
      <CardContent className="space-y-4">
        {/* Title */}
        <div>
          <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-1">Offer Title</div>
          <div className="text-sm text-text-primary">{offerLetter.title}</div>
        </div>

        {/* Dynamic fields from the form */}
        {fields.length > 0 && Object.keys(fieldValues).length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {fields
              .sort((a, b) => a.display_order - b.display_order)
              .filter(f => fieldValues[f.field_name] !== undefined)
              .map(field => {
                const value = fieldValues[field.field_name]
                const label = field.field_label
                const fieldType = field.field_type

                let displayValue: string
                if (fieldType === 'location') {
                  displayValue = formatLocationValue(value)
                } else if (fieldType === 'salary') {
                  displayValue = formatSalaryValue(value, field.field_config)
                } else if (fieldType === 'checkbox') {
                  displayValue = value ? 'Yes' : 'No'
                } else if (fieldType === 'date' && value) {
                  try {
                    displayValue = new Date(String(value) + 'T00:00:00').toLocaleDateString()
                  } catch {
                    displayValue = String(value)
                  }
                } else if (fieldType === 'recruiter') {
                  const match = recruiterOptions.find(r => r.value === value)
                  displayValue = match?.label || String(value)
                } else if (fieldType === 'employment_type') {
                  displayValue = employmentTypeLabels[String(value)] || String(value)
                } else if (fieldType === 'work_location') {
                  displayValue = workLocationLabels[String(value)] || String(value)
                } else {
                  displayValue = value != null && value !== '' ? String(value) : '—'
                }

                return (
                  <div key={field.field_name}>
                    <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-1">{label}</div>
                    <div className="text-sm text-text-primary">{displayValue}</div>
                  </div>
                )
              })}
          </div>
        ) : (
          <p className="text-sm text-text-secondary">No field values recorded.</p>
        )}

      </CardContent>

      {offerLetter && candidate && (
        <GenerateOfferDialog
          open={showGenerateDialog}
          onOpenChange={setShowGenerateDialog}
          offerLetterData={{
            candidate,
            job: job || {},
            organization: organization || {},
            fieldValues: fieldValues,
            fieldTypes: Object.fromEntries(fields.map(f => [f.field_name, f.field_type])),
            recruiterLookup: Object.fromEntries(recruiterOptions.map(r => [r.value, r.label])),
          }}
          offerLetterId={offerLetter.id}
          candidateId={candidateId}
          candidateName={candidate.candidate_name || 'Candidate'}
          onSuccess={() => {
            // Refetch offer letters to reflect finalized status
            window.dispatchEvent(new CustomEvent('refetch-attachments'))
          }}
        />
      )}
    </Card>

    <MinimizableEmailComposer
      isOpen={showEmailComposer}
      onOpenChange={setShowEmailComposer}
      candidateId={candidateId}
      jobId={jobId}
      defaultTo={candidate?.email || candidate?.contact_email || ''}
      candidateName={candidate?.candidate_name || 'Candidate'}
      defaultSubject={`Offer Letter - ${job?.title || 'Position'}`}
      onSuccess={() => setShowEmailComposer(false)}
    />
    </>
  )
}

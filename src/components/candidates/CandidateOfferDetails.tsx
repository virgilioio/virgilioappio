import { useState, useEffect, useCallback } from 'react'
import { useOfferLetters } from '@/hooks/useOfferLetters'
import { useOfferFormFields } from '@/hooks/useOfferFormFields'
import { useRecruiterOptions } from '@/hooks/useRecruiterOptions'
import { useOfferApprovalRequest } from '@/hooks/useOfferApprovalRequest'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Alert } from '@/components/ui/alert'
import { Loader2, Send, Pencil, Undo2, Check, X, FileText } from 'lucide-react'
import gioFaceEmpty from '@/assets/gio-face-empty.png'
import { GenerateOfferDialog } from './GenerateOfferDialog'
import { MinimizableEmailComposer } from './MinimizableEmailComposer'
import { supabase } from '@/lib/supabaseClient'
import { logActivity } from '@/lib/activityLogger'


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

function getStatusTone(status: string): BadgeTone {
  switch (status) {
    case 'draft': return 'neutral'
    case 'pending_approval': return 'yellow'
    case 'approved': return 'green'
    case 'finalized': return 'green'
    case 'sent': return 'blue'
    case 'accepted': return 'green'
    case 'declined': return 'red'
    default: return 'neutral'
  }
}

function getStatusLabel(status: string) {
  if (status === 'pending_approval') return 'Pending Approval'
  if (status === 'approved') return 'Approved'
  return status.charAt(0).toUpperCase() + status.slice(1)
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
      <Card>
        <CardContent className="py-8">
          <div className="text-body-sm text-text-secondary text-center">Loading offer details...</div>
        </CardContent>
      </Card>
    )
  }

  if (!offerLetter) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <img
              src={gioFaceEmpty}
              alt="No offer details"
              className="h-16 w-16 mx-auto mb-4 rounded-full"
            />
            <CardTitle className="mb-2">No offer details yet</CardTitle>
            <p className="text-body-sm text-text-secondary">
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

  const declinedNote = approvalRequest?.steps.find(s => s.status === 'declined')?.notes

  return (
    <>
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <CardTitle>Offer Details</CardTitle>
            <Badge tone={getStatusTone(offerLetter.status)} dot size="sm">
              {getStatusLabel(offerLetter.status)}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {associationStatus !== 'hired' && onEdit && (
              <Button
                variant="secondary"
                icon={Pencil}
                onClick={() => onEdit({
                  id: offerLetter.id,
                  form_id: offerLetter.form_id || '',
                  field_values: offerLetter.field_values || {},
                })}
              >
                Edit
              </Button>
            )}
            {offerLetter.status === 'pending_approval' && isCurrentUserActiveApprover && !showApproveForm && !showDeclineForm && (
              <>
                <Button
                  variant="danger"
                  icon={X}
                  onClick={() => setShowDeclineForm(true)}
                  disabled={isApproving || isDeclining}
                >
                  Decline
                </Button>
                <Button
                  variant="primary"
                  icon={Check}
                  onClick={() => setShowApproveForm(true)}
                  disabled={isApproving || isDeclining}
                >
                  Approve
                </Button>
              </>
            )}
            {offerLetter.status === 'approved' && approvalRequest?.status === 'approved' && (
              <Button
                variant="primary"
                icon={FileText}
                onClick={() => setShowGenerateDialog(true)}
              >
                Generate Offer Letter
              </Button>
            )}
            {offerLetter.status === 'approved' && !!offerDocument && (
              <Button
                variant="primary"
                icon={Send}
                onClick={() => setShowEmailComposer(true)}
              >
                Send Offer
              </Button>
            )}
            {offerLetter.status === 'draft' && chainEnabled && chainHasSteps && !isActiveRequest && (
              <Button
                variant="purple"
                icon={Send}
                onClick={() => requestApproval(offerLetter.id, jobId, candidateId)}
                loading={isRequesting}
              >
                Request Approval
              </Button>
            )}
            {offerLetter.status === 'pending_approval' && isCurrentUserRequester && approvalRequest && (
              <Button
                variant="secondary"
                icon={Undo2}
                onClick={() => recallApproval(approvalRequest.id)}
                loading={isRecalling}
              >
                Recall
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Status banners */}
        {approvalRequest?.status === 'approved' && (
          <Alert variant="success">
            <Check className="h-4 w-4" />
            <span className="text-body-sm font-medium pl-7 block">This offer has been approved</span>
          </Alert>
        )}
        {offerDocument && (
          <Alert
            variant="info"
            role="button"
            tabIndex={0}
            onClick={async () => {
              const { data } = await supabase.storage
                .from('candidate-attachments')
                .createSignedUrl(offerDocument.file_path, 300)
              if (data?.signedUrl) window.open(data.signedUrl, '_blank')
            }}
            className="cursor-pointer hover:bg-info/30 transition-colors"
          >
            <FileText className="h-4 w-4" />
            <div className="pl-7">
              <span className="text-body-sm font-medium block">Offer document generated</span>
              <p className="text-body-xs text-text-secondary">{offerDocument.file_name}</p>
            </div>
          </Alert>
        )}
        {approvalRequest?.status === 'declined' && offerLetter.status === 'draft' && (
          <Alert variant="destructive">
            <X className="h-4 w-4" />
            <div className="pl-7">
              <span className="text-body-sm font-medium block">This offer has been declined</span>
              {declinedNote && (
                <p className="text-body-xs opacity-80 mt-1">{declinedNote}</p>
              )}
            </div>
          </Alert>
        )}

        {/* Inline approve form */}
        {showApproveForm && (
          <div className="p-layout-md rounded-lg border border-virgilio-border bg-surface-secondary space-y-3">
            <p className="text-form-label">Approve this offer</p>
            <Textarea
              placeholder="Add a comment (optional)..."
              value={approveComment}
              onChange={(e) => setApproveComment(e.target.value)}
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setShowApproveForm(false); setApproveComment('') }}>
                Cancel
              </Button>
              <Button variant="primary" icon={Check} onClick={handleApprove} loading={isApproving}>
                Confirm Approve
              </Button>
            </div>
          </div>
        )}

        {/* Inline decline form */}
        {showDeclineForm && (
          <div className="p-layout-md rounded-lg border border-destructive/20 bg-destructive/5 space-y-3">
            <p className="text-form-label text-destructive">Decline this offer</p>
            <Textarea
              placeholder="Add a reason (optional)..."
              value={declineComment}
              onChange={(e) => setDeclineComment(e.target.value)}
              rows={2}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => { setShowDeclineForm(false); setDeclineComment('') }}>
                Cancel
              </Button>
              <Button variant="dangerSolid" icon={X} onClick={handleDecline} loading={isDeclining}>
                Confirm Decline
              </Button>
            </div>
          </div>
        )}

        {/* Title */}
        <div>
          <div className="text-form-label mb-1">Offer Title</div>
          <div className="text-body-md text-text-primary">{offerLetter.title}</div>
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
            window.dispatchEvent(new CustomEvent('refetch-attachments'))
            logActivity({
              activityType: 'offer_document_generated',
              title: 'Offer document generated',
              description: `Offer letter document generated for ${candidate?.candidate_name || 'candidate'}`,
              entityType: 'candidate',
              entityId: candidateId,
              organizationId: organizationId || undefined,
              metadata: { jobId, offerLetterId: offerLetter.id },
            })
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
      onSuccess={() => {
        setShowEmailComposer(false)
        logActivity({
          activityType: 'offer_sent',
          title: 'Offer sent',
          description: `Offer letter sent to ${candidate?.candidate_name || 'candidate'}`,
          entityType: 'candidate',
          entityId: candidateId,
          organizationId: organizationId || undefined,
          metadata: { jobId, offerLetterId: offerLetter?.id },
        })
      }}
    />
    </>
  )
}

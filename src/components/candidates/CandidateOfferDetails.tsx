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
import { Loader2, Send, Pencil, Undo2, Check, X, FileText, DollarSign, MapPin, Calendar, Briefcase, User, BadgeCheck, Building2 } from 'lucide-react'
import { InlineEmpty } from '@/components/ui/empty-state'
import { GenerateOfferDialog } from './GenerateOfferDialog'
import { MinimizableEmailComposer } from './MinimizableEmailComposer'
import { supabase } from '@/lib/supabaseClient'
import { logActivity } from '@/lib/activityLogger'
import { cn } from '@/lib/utils'

function LongTextField({ label, value }: { label: string; value: string }) {
  const [expanded, setExpanded] = useState(false)
  const long = value.length > 220
  return (
    <div>
      <p className="font-inter uppercase mb-1.5" style={{ fontSize: 10.5, letterSpacing: '0.08em', color: '#8B8F9E' }}>{label}</p>
      <p className={cn('font-inter text-[13px] text-text-primary whitespace-pre-wrap', !expanded && long && 'line-clamp-2')} style={{ lineHeight: 1.5 }}>
        {value}
      </p>
      {long && (
        <button type="button" onClick={() => setExpanded(e => !e)} className="mt-1 font-inter text-[12px] text-virgilio-purple hover:underline">
          {expanded ? 'Show less' : 'Show more'}
        </button>
      )}
    </div>
  )
}


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
        <CardContent className="p-4">
          <InlineEmpty text="No offer yet." />
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
              <p className="text-body-sm text-text-secondary">{offerDocument.file_name}</p>
            </div>
          </Alert>
        )}
        {approvalRequest?.status === 'declined' && offerLetter.status === 'draft' && (
          <Alert variant="destructive">
            <X className="h-4 w-4" />
            <div className="pl-7">
              <span className="text-body-sm font-medium block">This offer has been declined</span>
              {declinedNote && (
                <p className="text-body-sm opacity-80 mt-1">{declinedNote}</p>
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

        {/* Grouped field layout: currency tiles → short pairs → long text */}
        {(() => {
          if (fields.length === 0 || Object.keys(fieldValues).length === 0) {
            return <InlineEmpty text="No field values recorded." />
          }
          const sorted = [...fields]
            .sort((a, b) => a.display_order - b.display_order)
            .filter(f => fieldValues[f.field_name] !== undefined)

          const currencyFields = sorted.filter(f => f.field_type === 'salary')
          const longFields = sorted.filter(f =>
            f.field_type === 'textarea' ||
            (typeof fieldValues[f.field_name] === 'string' && (fieldValues[f.field_name] as string).length > 140)
          )
          const shortFields = sorted.filter(f => !currencyFields.includes(f) && !longFields.includes(f))

          const iconFor = (t: string) =>
            t === 'salary' ? DollarSign
            : t === 'location' ? MapPin
            : t === 'work_location' ? Building2
            : t === 'date' ? Calendar
            : t === 'employment_type' ? Briefcase
            : t === 'recruiter' ? User
            : t === 'checkbox' ? BadgeCheck
            : FileText

          const renderValue = (field: any) => {
            const value = fieldValues[field.field_name]
            const t = field.field_type
            if (t === 'location') return formatLocationValue(value)
            if (t === 'salary') return formatSalaryValue(value, field.field_config)
            if (t === 'checkbox') return value ? 'Yes' : 'No'
            if (t === 'date' && value) {
              try { return new Date(String(value) + 'T00:00:00').toLocaleDateString() } catch { return String(value) }
            }
            if (t === 'recruiter') {
              const match = recruiterOptions.find(r => r.value === value)
              return match?.label || String(value)
            }
            if (t === 'employment_type') return employmentTypeLabels[String(value)] || String(value)
            if (t === 'work_location') return workLocationLabels[String(value)] || String(value)
            return value != null && value !== '' ? String(value) : '—'
          }

          return (
            <div className="space-y-5">
              {/* Currency stat tiles */}
              {currencyFields.length > 0 && (
                <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(currencyFields.length, 3)}, minmax(0, 1fr))` }}>
                  {currencyFields.map((field, idx) => {
                    const isAccent = idx === 0 && currencyFields.length > 1
                    return (
                      <div
                        key={field.field_name}
                        className={cn(
                          'rounded-xl px-4 py-3 border',
                          isAccent ? 'border-transparent' : 'border-[#F1F0EC] bg-[#FAFAF7]',
                        )}
                        style={isAccent ? { backgroundColor: '#EDE4FF' } : undefined}
                      >
                        <p className="font-inter uppercase" style={{ fontSize: 10.5, letterSpacing: '0.08em', color: isAccent ? '#5B2BD9' : '#8B8F9E' }}>
                          {field.field_label}
                        </p>
                        <p className="font-poppins font-semibold mt-1.5 tabular-nums" style={{ fontSize: 17, letterSpacing: '-0.02em', color: '#0d0d09' }}>
                          {renderValue(field)}
                        </p>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Short fields — 2-col icon+label+value */}
              {shortFields.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
                  <div className="flex items-start gap-2.5">
                    <span className="text-text-tertiary mt-0.5"><FileText className="h-3.5 w-3.5" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="font-inter text-[11.5px] text-[#8B8F9E]">Offer title</p>
                      <p className="font-poppins text-[13px] text-text-primary truncate">{offerLetter.title}</p>
                    </div>
                  </div>
                  {shortFields.map(field => {
                    const Icon = iconFor(field.field_type)
                    return (
                      <div key={field.field_name} className="flex items-start gap-2.5">
                        <span className="text-text-tertiary mt-0.5"><Icon className="h-3.5 w-3.5" /></span>
                        <div className="min-w-0 flex-1">
                          <p className="font-inter text-[11.5px] text-[#8B8F9E]">{field.field_label}</p>
                          <p className="font-poppins text-[13px] text-text-primary truncate">{renderValue(field)}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Long text fields */}
              {longFields.map(field => (
                <LongTextField key={field.field_name} label={field.field_label} value={String(renderValue(field))} />
              ))}
            </div>
          )
        })()}



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

import { useOfferLetters } from '@/hooks/useOfferLetters'
import { useOfferFormFields } from '@/hooks/useOfferFormFields'
import { useRecruiterOptions } from '@/hooks/useRecruiterOptions'
import { useOfferApprovalRequest } from '@/hooks/useOfferApprovalRequest'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Loader2, Send, Clock, Pencil } from 'lucide-react'
import gioFaceEmpty from '@/assets/gio-face-empty.png'

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
  onEdit?: () => void
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
    case 'finalized': return 'default'
    case 'sent': return 'default'
    case 'accepted': return 'default'
    case 'declined': return 'destructive'
    default: return 'secondary'
  }
}

function getStatusLabel(status: string) {
  if (status === 'pending_approval') return 'Pending Approval'
  return status
}

export function CandidateOfferDetails({ candidateId, jobId, organizationId }: CandidateOfferDetailsProps) {
  const { offerLetters, isLoading } = useOfferLetters(candidateId)
  const { data: recruiterOptions = [] } = useRecruiterOptions(organizationId || null)
  
  // Find the offer letter for this job
  const offerLetter = offerLetters.find(ol => ol.job_id === jobId)
  const { fields } = useOfferFormFields(offerLetter?.form_id || undefined)
  const { approvalRequest, chainEnabled, chainHasSteps, requestApproval, isRequesting } = useOfferApprovalRequest(offerLetter?.id, jobId)

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

  return (
    <Card className="bg-surface-primary border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Offer Details</CardTitle>
          <div className="flex items-center gap-2">
            {offerLetter.status === 'draft' && chainEnabled && chainHasSteps && !approvalRequest && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => requestApproval(offerLetter.id, jobId, candidateId)}
                disabled={isRequesting}
              >
                {isRequesting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
                Request Approval
              </Button>
            )}
            <Badge variant={getStatusVariant(offerLetter.status) as any} className="capitalize">
              {getStatusLabel(offerLetter.status)}
            </Badge>
          </div>
        </div>
      </CardHeader>
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
    </Card>
  )
}

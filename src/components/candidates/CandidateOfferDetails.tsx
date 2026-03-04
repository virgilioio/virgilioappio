import { useOfferLetters } from '@/hooks/useOfferLetters'
import { useOfferFormFields } from '@/hooks/useOfferFormFields'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import gioFaceEmpty from '@/assets/gio-face-empty.png'

interface CandidateOfferDetailsProps {
  candidateId: string
  jobId: string
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
    case 'finalized': return 'default'
    case 'sent': return 'default'
    case 'accepted': return 'default'
    case 'declined': return 'destructive'
    default: return 'secondary'
  }
}

export function CandidateOfferDetails({ candidateId, jobId }: CandidateOfferDetailsProps) {
  const { offerLetters, isLoading } = useOfferLetters(candidateId)
  
  // Find the offer letter for this job
  const offerLetter = offerLetters.find(ol => ol.job_id === jobId)
  const { fields } = useOfferFormFields(offerLetter?.form_id || undefined)

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

  // Build a map of field_name -> field metadata from form fields
  const fieldMap = new Map(fields.map(f => [f.field_name, f]))
  const fieldValues = offerLetter.field_values || {}

  return (
    <Card className="bg-surface-primary border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Offer Details</CardTitle>
          <Badge variant={getStatusVariant(offerLetter.status) as any} className="capitalize">
            {offerLetter.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Title */}
        <div>
          <div className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-1">Offer Title</div>
          <div className="text-sm text-text-primary">{offerLetter.title}</div>
        </div>

        {/* Dynamic fields from the form */}
        {Object.entries(fieldValues).length > 0 ? (
          <div className="grid grid-cols-1 gap-4">
            {Object.entries(fieldValues).map(([fieldName, value]) => {
              const fieldMeta = fieldMap.get(fieldName)
              const label = fieldMeta?.field_label || fieldName.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
              const fieldType = fieldMeta?.field_type

              let displayValue: string
              if (fieldType === 'location') {
                displayValue = formatLocationValue(value)
              } else if (fieldType === 'salary') {
                displayValue = formatSalaryValue(value, fieldMeta?.field_config)
              } else if (fieldType === 'checkbox') {
                displayValue = value ? 'Yes' : 'No'
              } else if (fieldType === 'date' && value) {
                try {
                  displayValue = new Date(String(value)).toLocaleDateString()
                } catch {
                  displayValue = String(value)
                }
              } else {
                displayValue = value != null && value !== '' ? String(value) : '—'
              }

              return (
                <div key={fieldName}>
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

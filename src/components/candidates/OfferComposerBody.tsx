import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, ClipboardList, MapPin, DollarSign, Phone } from 'lucide-react'
import { useOfferForms } from '@/hooks/useOfferForms'
import { CurrencySelect } from '@/components/ui/currency-select'
import type { SalaryFieldConfig, LocationFieldConfig, PhoneFieldConfig } from '@/hooks/useJobPostingFields'
import { useOfferFormFields, type OfferFormField } from '@/hooks/useOfferFormFields'
import { useOfferLetters } from '@/hooks/useOfferLetters'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { Badge } from '@/components/ui/badge'
import { PhoneInput } from '@/components/ui/phone-input'
import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useRecruiterOptions } from '@/hooks/useRecruiterOptions'

interface OfferComposerBodyProps {
  candidateId: string
  candidateName: string
  jobId: string
  jobTitle?: string
  organizationId: string
  selectedFormId: string
  onSelectedFormIdChange: (id: string) => void
  fieldValues: Record<string, any>
  onFieldValuesChange: (values: Record<string, any>) => void
  onSuccess: () => void
  onCancel: () => void
  draftRestored?: boolean
}

export function OfferComposerBody({
  candidateId,
  candidateName,
  jobId,
  jobTitle,
  organizationId,
  selectedFormId,
  onSelectedFormIdChange,
  fieldValues,
  onFieldValuesChange,
  onSuccess,
  onCancel,
  draftRestored,
}: OfferComposerBodyProps) {
  const { user } = useAuth()
  const { forms, isLoading: formsLoading } = useOfferForms()
  const { fields, isLoading: fieldsLoading } = useOfferFormFields(selectedFormId)
  const { createOfferLetter, isLoading: creatingLetter } = useOfferLetters(candidateId)
  const { data: recruiterOptions = [] } = useRecruiterOptions(organizationId)

  const activeForms = forms.filter(f => f.is_active)

  // Reset field values when form changes (but not on initial draft restore)
  useEffect(() => {
    if (!draftRestored) {
      onFieldValuesChange({})
    }
  }, [selectedFormId])

  const handleFieldChange = (fieldName: string, value: any) => {
    onFieldValuesChange({ ...fieldValues, [fieldName]: value })
  }

  const canSave = () => {
    if (!selectedFormId || !organizationId || !jobId) return false
    const requiredFields = fields.filter(f => f.is_required)
    return requiredFields.every(field => {
      const val = fieldValues[field.field_name]
      return val !== undefined && val !== null && val !== ''
    })
  }

  const handleSave = async () => {
    if (!organizationId) {
      toast({ title: 'Error', description: 'Organization is required.', variant: 'destructive' })
      return
    }
    if (!jobId) {
      toast({ title: 'Error', description: 'Job association is required to create an offer.', variant: 'destructive' })
      return
    }
    try {
      const title = `Offer - ${candidateName} - ${jobTitle || 'Position'}`
      await createOfferLetter({
        candidate_id: candidateId,
        job_id: jobId,
        form_id: selectedFormId,
        organization_id: organizationId,
        title,
        field_values: fieldValues,
        status: 'draft',
        created_by: user?.id,
      })
      onSuccess()
    } catch (error) {
      console.error('Failed to create offer:', error)
    }
  }

  const renderFieldInput = (field: OfferFormField) => {
    const value = fieldValues[field.field_name] || ''
    const placeholder = field.placeholder_text || `Enter ${field.field_label.toLowerCase()}...`

    switch (field.field_type) {
      case 'textarea':
        return (
          <Textarea
            id={field.field_name}
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
            placeholder={placeholder}
            rows={3}
          />
        )
      case 'date':
        return (
          <DatePickerVirgilio
            value={value ? new Date(value) : undefined}
            onChange={(date) => handleFieldChange(field.field_name, date.toISOString().split('T')[0])}
            placeholder="Pick a date"
          />
        )
      case 'number':
        return (
          <Input
            id={field.field_name}
            type="number"
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
            placeholder={placeholder}
          />
        )
      case 'email':
        return (
          <Input
            id={field.field_name}
            type="email"
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
            placeholder={placeholder}
          />
        )
      case 'checkbox':
        return (
          <div className="flex items-center space-x-2 h-10">
            <input
              type="checkbox"
              id={field.field_name}
              checked={!!value}
              onChange={(e) => handleFieldChange(field.field_name, e.target.checked)}
              className="h-4 w-4 rounded border-input"
            />
            <Label htmlFor={field.field_name}>{field.field_label}</Label>
          </div>
        )
      case 'salary': {
        const salaryConfig = (field as any).field_config as SalaryFieldConfig | null
        const period = salaryConfig?.period || 'annually'
        const salaryValue = (() => {
          try {
            if (typeof value === 'object' && value) return value
            if (typeof value === 'string' && value) return JSON.parse(value)
            return { amount: '', currency: salaryConfig?.currency || 'USD' }
          } catch { return { amount: '', currency: salaryConfig?.currency || 'USD' } }
        })()
        return (
          <div className="flex items-center gap-2">
            <div className="w-[180px] shrink-0">
              <CurrencySelect
                value={salaryValue.currency}
                onChange={(c) => handleFieldChange(field.field_name, JSON.stringify({ ...salaryValue, currency: c }))}
              />
            </div>
            <Input
              id={field.field_name}
              type="number"
              value={salaryValue.amount}
              onChange={(e) => handleFieldChange(field.field_name, JSON.stringify({ ...salaryValue, amount: e.target.value }))}
              placeholder="Enter amount"
            />
            <Badge variant="secondary" className="shrink-0 capitalize">{period}</Badge>
          </div>
        )
      }
      case 'location': {
        const locationConfig = (field as any).field_config as LocationFieldConfig | null
        const locationFields = locationConfig?.fields || ['city', 'state', 'country']
        const locationValue = (() => {
          try {
            if (typeof value === 'string' && value) return JSON.parse(value)
            if (typeof value === 'object' && value) return value
            return {}
          } catch { return {} }
        })()
        const updateLocation = (key: string, val: string) => {
          const next = { ...locationValue, [key]: val }
          handleFieldChange(field.field_name, JSON.stringify(next))
        }
        const colsClass = ({ 1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3' } as Record<number, string>)[locationFields.length] || 'md:grid-cols-3'
        return (
          <div className={`grid grid-cols-1 ${colsClass} gap-3`}>
            {locationFields.includes('city') && (
              <Input
                placeholder="City"
                value={locationValue.city || ''}
                onChange={(e) => updateLocation('city', e.target.value)}
              />
            )}
            {locationFields.includes('state') && (
              <Input
                placeholder="State / Province"
                value={locationValue.state || ''}
                onChange={(e) => updateLocation('state', e.target.value)}
              />
            )}
            {locationFields.includes('country') && (
              <Input
                placeholder="Country"
                value={locationValue.country || ''}
                onChange={(e) => updateLocation('country', e.target.value)}
              />
            )}
          </div>
        )
      }
      case 'phone': {
        const phoneConfig = (field as any).field_config as PhoneFieldConfig | null
        const defaultCountry = phoneConfig?.defaultCountryCode || '+1'
        return (
          <PhoneInput
            value={value || defaultCountry}
            onChange={(val) => handleFieldChange(field.field_name, val)}
            placeholder="Enter phone number"
          />
        )
      }
      case 'recruiter':
        return (
          <SearchableSelect
            options={recruiterOptions}
            value={value || ''}
            onValueChange={(val) => handleFieldChange(field.field_name, val)}
            placeholder="Search for a recruiter..."
          />
        )
      case 'employment_type':
        return (
          <Select value={value || ''} onValueChange={(v) => handleFieldChange(field.field_name, v)}>
            <SelectTrigger><SelectValue placeholder="Select employment type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="full_time">Full-time</SelectItem>
              <SelectItem value="part_time">Part-time</SelectItem>
              <SelectItem value="temporary">Temporary</SelectItem>
              <SelectItem value="internship">Internship</SelectItem>
            </SelectContent>
          </Select>
        )
      case 'work_location':
        return (
          <Select value={value || ''} onValueChange={(v) => handleFieldChange(field.field_name, v)}>
            <SelectTrigger><SelectValue placeholder="Select work location" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="remote">Remote</SelectItem>
              <SelectItem value="hybrid">Hybrid</SelectItem>
              <SelectItem value="onsite">On-site</SelectItem>
            </SelectContent>
          </Select>
        )
      default:
        return (
          <Input
            id={field.field_name}
            value={value}
            onChange={(e) => handleFieldChange(field.field_name, e.target.value)}
            placeholder={placeholder}
          />
        )
    }
  }

  return (
    <div className="space-y-6">
      {draftRestored && (
        <Badge variant="secondary" className="text-xs">Draft restored</Badge>
      )}

      {/* Offer Form Selector */}
      <div className="space-y-2">
        <Label>Select Offer Form</Label>
        {formsLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading forms...
          </div>
        ) : activeForms.length === 0 ? (
          <div className="text-center py-8 border border-dashed rounded-md">
            <ClipboardList className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No offer forms available</p>
            <p className="text-xs text-muted-foreground mt-1">
              Create offer forms in Settings → Templates → Offer Forms
            </p>
          </div>
        ) : (
          <Select value={selectedFormId} onValueChange={onSelectedFormIdChange}>
            <SelectTrigger>
              <SelectValue placeholder="Choose an offer form..." />
            </SelectTrigger>
            <SelectContent>
              {activeForms.map((form) => (
                <SelectItem key={form.id} value={form.id}>
                  <div className="flex flex-col">
                    <span>{form.name}</span>
                    {form.description && (
                      <span className="text-xs text-muted-foreground">{form.description}</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Dynamic Fields */}
      {selectedFormId && (
        <div className="space-y-4">
          {fieldsLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading form fields...
            </div>
          ) : fields.length === 0 ? (
            <div className="text-center py-6 border border-dashed rounded-md">
              <p className="text-sm text-muted-foreground">
                This form has no fields configured yet
              </p>
            </div>
          ) : (
            fields
              .sort((a, b) => a.display_order - b.display_order)
              .map((field) => (
                <div key={field.id} className="space-y-2">
                  {field.field_type !== 'checkbox' && (
                    <Label htmlFor={field.field_name}>
                      {field.field_label}
                      {field.is_required && <span className="text-destructive ml-1">*</span>}
                    </Label>
                  )}
                  {renderFieldInput(field)}
                  {field.help_text && (
                    <p className="text-xs text-muted-foreground">{field.help_text}</p>
                  )}
                </div>
              ))
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-4 border-t">
        <Button variant="outline" onClick={onCancel} disabled={creatingLetter}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={!canSave() || creatingLetter}>
          {creatingLetter && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          Save Offer
        </Button>
      </div>
    </div>
  )
}

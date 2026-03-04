import { useState, useEffect } from 'react'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, ClipboardList } from 'lucide-react'
import { useOfferForms } from '@/hooks/useOfferForms'
import { useOfferFormFields, type OfferFormField } from '@/hooks/useOfferFormFields'
import { useOfferLetters } from '@/hooks/useOfferLetters'
import { Candidate } from '@/hooks/useCandidates'
import { useAuth } from '@/contexts/AuthContext'
import { toast } from '@/hooks/use-toast'
import { PhoneInput } from '@/components/ui/phone-input'
import { DatePickerVirgilio } from '@/components/ui/date-picker-virgilio'
import type { PhoneFieldConfig, SalaryFieldConfig } from '@/hooks/useJobPostingFields'
import { CurrencySelect } from '@/components/ui/currency-select'
import { Badge } from '@/components/ui/badge'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useRecruiterOptions } from '@/hooks/useRecruiterOptions'

interface CreateOfferLetterSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  candidate: Candidate
  job: any
  organization: any
}

export function CreateOfferLetterSheet({
  open,
  onOpenChange,
  candidate,
  job,
  organization
}: CreateOfferLetterSheetProps) {
  const { user, organizationId } = useAuth()
  const { forms, isLoading: formsLoading } = useOfferForms()
  const [selectedFormId, setSelectedFormId] = useState<string>('')
  const { fields, isLoading: fieldsLoading } = useOfferFormFields(selectedFormId)
  const { createOfferLetter, isLoading: creatingLetter } = useOfferLetters(candidate.id)
  const [fieldValues, setFieldValues] = useState<Record<string, any>>({})
  const { data: recruiterOptions = [] } = useRecruiterOptions(organizationId)

  // Filter only active forms
  const activeForms = forms.filter(f => f.is_active)

  // Reset state when sheet opens/closes
  useEffect(() => {
    if (!open) {
      setSelectedFormId('')
      setFieldValues({})
    }
  }, [open])

  // Reset field values when form changes
  useEffect(() => {
    setFieldValues({})
  }, [selectedFormId])

  const handleFieldChange = (fieldName: string, value: any) => {
    setFieldValues(prev => ({ ...prev, [fieldName]: value }))
  }

  const canSave = () => {
    if (!selectedFormId) return false
    const effectiveOrgId = organizationId || organization?.id
    if (!effectiveOrgId) return false
    const requiredFields = fields.filter(f => f.is_required)
    return requiredFields.every(field => {
      const val = fieldValues[field.field_name]
      return val !== undefined && val !== null && val !== ''
    })
  }

  const handleSave = async () => {
    const effectiveOrgId = organizationId || organization?.id || ''

    if (!effectiveOrgId) {
      toast({ title: 'Error', description: 'Organization is required.', variant: 'destructive' })
      return
    }

    try {
      const selectedForm = forms.find(f => f.id === selectedFormId)
      const title = `Offer - ${candidate.candidate_name} - ${job?.title || 'Position'}`

      await createOfferLetter({
        candidate_id: candidate.id,
        job_id: candidate.job_id || '',
        form_id: selectedFormId,
        organization_id: effectiveOrgId,
        title,
        field_values: fieldValues,
        status: 'draft',
        created_by: user?.id
      })

      onOpenChange(false)
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Create Offer</SheetTitle>
          <SheetDescription>
            Create an offer for {candidate.candidate_name}{job?.title ? ` — ${job.title}` : ''}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
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
              <Select value={selectedFormId} onValueChange={setSelectedFormId}>
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
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creatingLetter}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!canSave() || creatingLetter}>
              {creatingLetter && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Offer
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  )
}

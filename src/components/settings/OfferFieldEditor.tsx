import type { OfferFormField } from '@/hooks/useOfferFormFields'
import { FormFieldEditor, ALL_FIELD_TYPES } from '@/components/shared/FormFieldEditor'
import type { FormFieldData } from '@/components/shared/FormFieldEditor'
import type { FieldType } from '@/hooks/useJobPostingFields'

// Offer forms don't support checkbox_group — filter it out
const OFFER_FIELD_TYPES = ALL_FIELD_TYPES.filter(t => t !== 'checkbox_group') as FieldType[]

interface OfferFieldEditorProps {
  field: OfferFormField
  onUpdate: (fieldId: string, updates: Partial<OfferFormField>) => void
  onDelete: (fieldId: string) => void
  disabled?: boolean
  dragHandlers?: {
    attributes: any
    listeners: any
  }
}

export function OfferFieldEditor({
  field,
  onUpdate,
  onDelete,
  disabled,
  dragHandlers,
}: OfferFieldEditorProps) {
  return (
    <FormFieldEditor
      field={field as FormFieldData}
      onUpdate={(id, updates) => onUpdate(id, updates as Partial<OfferFormField>)}
      onDelete={onDelete}
      disabled={disabled}
      dragHandlers={dragHandlers}
      availableTypes={OFFER_FIELD_TYPES}
    />
  )
}

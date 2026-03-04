import { PostingField, SelectOptionData } from '@/hooks/useJobPostingFields'
import { FormFieldEditor, ALL_FIELD_TYPES } from '@/components/shared/FormFieldEditor'
import type { FormFieldData } from '@/components/shared/FormFieldEditor'
import { supabase } from '@/lib/supabaseClient'

interface FieldEditorProps {
  field: PostingField
  onUpdate: (fieldId: string, updates: Partial<PostingField> & { select_options?: SelectOptionData[] }) => void
  onDelete: (fieldId: string) => void
  disabled?: boolean
  readOnly?: boolean
  dragHandlers?: {
    attributes: any
    listeners: any
  }
  isDefaultLibraryField?: boolean
}

export function FieldEditor({ 
  field, 
  onUpdate, 
  onDelete, 
  disabled, 
  readOnly, 
  dragHandlers,
  isDefaultLibraryField 
}: FieldEditorProps) {
  const loadSelectOptions = async (fieldId: string) => {
    const { data } = await supabase
      .from('posting_field_select_options')
      .select('option_value, option_label, display_order')
      .eq('posting_field_id', fieldId)
      .order('display_order', { ascending: true })
    return (data || []).map(o => ({ option_value: o.option_value, option_label: o.option_label, display_order: o.display_order }))
  }

  return (
    <FormFieldEditor
      field={field as FormFieldData}
      onUpdate={(id, updates) => onUpdate(id, updates as Partial<PostingField> & { select_options?: SelectOptionData[] })}
      onDelete={onDelete}
      disabled={disabled}
      readOnly={readOnly}
      dragHandlers={dragHandlers}
      isLocked={isDefaultLibraryField}
      sourceBadge={field.source === 'library' ? 'Library' : 'Custom'}
      loadSelectOptions={loadSelectOptions}
      availableTypes={ALL_FIELD_TYPES}
      context="job_posting"
    />
  )
}

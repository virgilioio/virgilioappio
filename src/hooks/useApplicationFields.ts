
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export type FieldType = 'text' | 'number' | 'email' | 'textarea' | 'select' | 'checkbox' | 'date' | 'file' | 'url'

export interface ApplicationField {
  id: string
  field_name: string
  field_label: string
  field_type: FieldType
  is_required: boolean
  is_default: boolean
  placeholder_text?: string | null
  help_text?: string | null
  display_order: number
  accepted_file_types?: string | null
  max_file_size_mb?: number | null
  created_by?: string | null
  created_at: string
  updated_at: string
}

export interface ApplicationFieldWithRelations extends ApplicationField {
  validation_rules: Array<{
    id: string
    rule_type: string
    rule_value: string
    error_message: string
  }>
  select_options: Array<{
    id: string
    option_value: string
    option_label: string
    display_order: number
  }>
}

export function useApplicationFields() {
  const [fields, setFields] = useState<ApplicationFieldWithRelations[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const { toast } = useToast()

  const fetchFields = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('application_fields')
        .select(`
          *,
          field_validation_rules(*),
          field_select_options(*)
        `)
        .eq('is_core_field', false) // Only fetch custom fields
        .order('display_order')

      if (error) throw error

      const mapped: ApplicationFieldWithRelations[] = (data || []).map((f: any) => ({
        ...f,
        validation_rules: f.field_validation_rules || [],
        select_options: (f.field_select_options || []).sort((a: any, b: any) => a.display_order - b.display_order)
      }))

      setFields(mapped)
    } catch (err) {
      console.error('Error fetching application fields:', err)
      toast({ title: 'Error', description: 'Failed to load application fields', variant: 'destructive' })
      setFields([])
    } finally {
      setIsLoading(false)
    }
  }

  const saveSelectOptions = async (fieldId: string, options: { value: string; label: string }[]) => {
    // Note: field_select_options table removed during compliance cleanup
    // This function is kept for backwards compatibility but does nothing
    console.warn('saveSelectOptions: field_select_options table no longer exists')
  }

  const saveValidationRules = async (
    fieldId: string,
    rules: { type: string; value: string; message: string }[]
  ) => {
    // Note: field_validation_rules table removed during compliance cleanup
    // This function is kept for backwards compatibility but does nothing
    console.warn('saveValidationRules: field_validation_rules table no longer exists')

    if (rules.length > 0) {
      const rows = rules.map((r) => ({
        application_field_id: fieldId,
        rule_type: r.type,
        rule_value: r.value,
        error_message: r.message,
      }))
      const { error: insErr } = await (supabase as any)
        .from('field_validation_rules')
        .insert(rows as any)
      if (insErr) throw insErr
    }
  }

  const createField = async (
    fieldData: Omit<ApplicationField, 'id' | 'created_at' | 'updated_at' | 'created_by'>,
    selectOptions?: { value: string; label: string }[],
    validationRules?: { type: string; value: string; message: string }[]
  ) => {
    const { data, error } = await supabase
      .from('application_fields')
      .insert(fieldData)
      .select()
      .maybeSingle()
    if (error) throw error
    if (!data) return null

    if (selectOptions && selectOptions.length > 0 && fieldData.field_type === 'select') {
      await saveSelectOptions(data.id, selectOptions)
    }
    if (validationRules && validationRules.length > 0) {
      await saveValidationRules(data.id, validationRules)
    }

    await fetchFields()
    toast({ title: 'Success', description: 'Field created successfully' })
    return data
  }

  const updateField = async (
    id: string,
    updates: Partial<ApplicationField>,
    selectOptions?: { value: string; label: string }[],
    validationRules?: { type: string; value: string; message: string }[]
  ) => {
    const { data, error } = await supabase
      .from('application_fields')
      .update(updates)
      .eq('id', id)
      .select()
      .maybeSingle()
    if (error) throw error

    // Manage related data
    if (selectOptions !== undefined) {
      await saveSelectOptions(id, selectOptions)
    }
    if (validationRules !== undefined) {
      await saveValidationRules(id, validationRules)
    }

    await fetchFields()
    toast({ title: 'Success', description: 'Field updated successfully' })
    return data
  }

  const deleteField = async (id: string) => {
    const { error } = await supabase
      .from('application_fields')
      .delete()
      .eq('id', id)
    if (error) throw error

    setFields((prev) => prev.filter((f) => f.id !== id))
    toast({ title: 'Success', description: 'Field deleted successfully' })
  }

  useEffect(() => {
    fetchFields()
  }, [])

  return { fields, isLoading, createField, updateField, deleteField, refetch: fetchFields }
}

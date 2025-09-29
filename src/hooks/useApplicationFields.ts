
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

// Simplified interface since validation_rules and select_options tables don't exist
export interface ApplicationFieldWithRelations extends ApplicationField {
  validation_rules: Array<any>
  select_options: Array<any>
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
        .select('*')
        .eq('is_core_field', false) // Only fetch custom fields
        .order('display_order')

      if (error) throw error

      const mapped: ApplicationFieldWithRelations[] = (data || []).map((f: any) => ({
        ...f,
        validation_rules: [], // Empty since table doesn't exist
        select_options: [] // Empty since table doesn't exist
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
  }

  const createField = async (
    fieldData: Omit<ApplicationField, 'id' | 'created_at' | 'updated_at' | 'created_by'>,
    selectOptions?: { value: string; label: string }[],
    validationRules?: { type: string; value: string; message: string }[]
  ) => {
    const { data: { user } } = await supabase.auth.getUser()
    
    // Get user's organization for workspace owners
    const { data: memberData } = await supabase
      .from('members')
      .select('organization_id, user_type')
      .eq('user_id', user?.id)
      .eq('user_status', 'active')
      .single()

    const enrichedFieldData = {
      ...fieldData,
      organization_id: memberData?.user_type === 'workspace_owner' ? memberData.organization_id : null,
      created_by: user?.id
    }

    const { data, error } = await supabase
      .from('application_fields')
      .insert(enrichedFieldData)
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

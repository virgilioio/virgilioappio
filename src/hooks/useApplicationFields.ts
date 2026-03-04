
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
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
  source?: 'platform' | 'tenant'
  tenant_id?: string | null
}

// Simplified interface since validation_rules and select_options tables don't exist
export interface ApplicationFieldWithRelations extends ApplicationField {
  validation_rules: Array<any>
  select_options: Array<any>
}

export type ApplicationFieldsContext = 'platform-defaults' | 'organization'

export function useApplicationFields(context: ApplicationFieldsContext = 'organization') {
  const [fields, setFields] = useState<ApplicationFieldWithRelations[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const { toast } = useToast()

  const fetchFields = async () => {
    try {
      setIsLoading(true)
      let query = supabase
        .from('application_fields')
        .select('*')
        .eq('is_core_field', false) // Only fetch custom fields

      // Filter based on context
      if (context === 'platform-defaults') {
        query = query.is('tenant_id', null)
      } else {
        // For organization context, get both platform defaults and tenant fields
        const { data: { user } } = await supabase.auth.getUser()
        const { data: memberData } = await supabase
          .from('members')
          .select('tenant_id')
          .eq('user_id', user?.id)
          .eq('user_status', 'active')
          .single()

        if (memberData?.tenant_id) {
          // Fetch both platform defaults (tenant_id IS NULL) and tenant-specific fields
          query = query.or(`tenant_id.is.null,tenant_id.eq.${memberData.tenant_id}`)
        } else {
          // If no tenant, show only platform defaults
          query = query.is('tenant_id', null)
        }
      }

      const { data, error } = await query
        .order('tenant_id', { ascending: true, nullsFirst: true }) // Platform defaults first
        .order('display_order')

      if (error) throw error

      const mapped: ApplicationFieldWithRelations[] = (data || []).map((f: any) => ({
        ...f,
        validation_rules: [], // Empty since table doesn't exist
        select_options: [], // Empty since table doesn't exist
        source: f.tenant_id ? 'tenant' as const : 'platform' as const
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
    
    // Get user's tenant for workspace owners
    const { data: memberData } = await supabase
      .from('members')
      .select('tenant_id, user_type')
      .eq('user_id', user?.id)
      .eq('user_status', 'active')
      .single()

    let tenantId = null
    if (context === 'organization' && memberData?.user_type === 'workspace_owner') {
      tenantId = memberData.tenant_id
    }
    // For platform-defaults context, tenantId stays null

    const enrichedFieldData = {
      ...fieldData,
      tenant_id: tenantId,
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
    validationRules?: { type: string; value: string; message: string }[],
    options?: { silent?: boolean }
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

    if (!options?.silent) {
      await fetchFields()
      toast({ title: 'Success', description: 'Field updated successfully' })
    }
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

  const copyPlatformTemplate = async (templateId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: memberData } = await supabase
        .from('members')
        .select('tenant_id')
        .eq('user_id', user?.id)
        .eq('user_status', 'active')
        .single()

      if (!memberData?.tenant_id) {
        throw new Error('No tenant found')
      }

      const { data, error } = await supabase.rpc('copy_platform_template_to_tenant', {
        p_template_table: 'application_fields',
        p_template_id: templateId,
        p_target_tenant_id: memberData.tenant_id
      })

      if (error) throw error
      
      await fetchFields()
      toast({
        title: 'Success',
        description: 'Field copied to your library'
      })
      
      return data
    } catch (error: any) {
      console.error('Error copying platform template:', error)
      toast({
        title: 'Error',
        description: error.message || 'Failed to copy template',
        variant: 'destructive'
      })
      throw error
    }
  }

  useEffect(() => {
    fetchFields()
  }, [])

  return { fields, isLoading, createField, updateField, deleteField, copyPlatformTemplate, refetch: fetchFields }
}

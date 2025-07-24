import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'

export interface WorkerComplianceField {
  id: string
  worker_country_id: string
  field_name: string
  field_label: string
  field_type: 'text' | 'number' | 'email' | 'textarea' | 'select' | 'checkbox' | 'date' | 'file'
  is_required: boolean
  placeholder_text?: string
  help_text?: string
  display_order: number
  accepted_file_types?: string
  max_file_size_mb?: number
  created_by?: string
  created_at: string
  updated_at: string
}

export interface WorkerComplianceFieldWithRelations extends WorkerComplianceField {
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

export function useWorkerComplianceFields(countryNameOrCode?: string) {
  const [fields, setFields] = useState<WorkerComplianceFieldWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchFieldsForCountry = async (nameOrCode: string) => {
    try {
      setIsLoading(true)
      
      // First get the country ID - try by name first, then by code
      const { data: countryData, error: countryError } = await supabase
        .from('worker_compliance_countries')
        .select('id')
        .or(`name.eq.${nameOrCode},code.eq.${nameOrCode}`)
        .single()

      if (countryError || !countryData) {
        console.error('Error fetching worker compliance country:', countryError)
        setFields([])
        return
      }

      // Then get the fields with their relations
      const { data: fieldsData, error: fieldsError } = await supabase
        .from('worker_compliance_fields')
        .select(`
          *,
          worker_compliance_field_validation_rules(*),
          worker_compliance_field_options(*)
        `)
        .eq('worker_country_id', countryData.id)
        .order('display_order')

      if (fieldsError) {
        console.error('Error fetching worker compliance fields:', fieldsError)
        setFields([])
        return
      }

      // Map the data to include validation rules and select options
      const mappedFields: WorkerComplianceFieldWithRelations[] = (fieldsData || []).map(field => ({
        ...field,
        validation_rules: field.worker_compliance_field_validation_rules || [],
        select_options: (field.worker_compliance_field_options || []).sort((a, b) => a.display_order - b.display_order)
      }))

      setFields(mappedFields)
    } catch (error) {
      console.error('Unexpected error fetching worker compliance fields:', error)
      setFields([])
    } finally {
      setIsLoading(false)
    }
  }

  const saveSelectOptions = async (fieldId: string, options: { value: string; label: string }[]) => {
    try {
      // Delete existing options
      await supabase
        .from('worker_compliance_field_options')
        .delete()
        .eq('worker_compliance_field_id', fieldId)

      // Insert new options
      if (options.length > 0) {
        const optionsToInsert = options.map((option, index) => ({
          worker_compliance_field_id: fieldId,
          option_value: option.value,
          option_label: option.label,
          display_order: index
        }))

        const { error } = await supabase
          .from('worker_compliance_field_options')
          .insert(optionsToInsert)

        if (error) throw error
      }
    } catch (error) {
      console.error('Error saving worker compliance field options:', error)
      throw error
    }
  }

  const createField = async (
    fieldData: Omit<WorkerComplianceField, 'id' | 'created_at' | 'updated_at' | 'created_by'>,
    selectOptions?: { value: string; label: string }[]
  ) => {
    try {
      const { data, error } = await supabase
        .from('worker_compliance_fields')
        .insert(fieldData)
        .select()
        .single()

      if (error) throw error

      // Save select options if provided
      if (selectOptions && selectOptions.length > 0) {
        await saveSelectOptions(data.id, selectOptions)
      }

      if (countryNameOrCode) {
        await fetchFieldsForCountry(countryNameOrCode)
      }
      
      return data
    } catch (error) {
      console.error('Error creating worker compliance field:', error)
      throw error
    }
  }

  const updateField = async (
    id: string,
    updates: Partial<WorkerComplianceField>,
    selectOptions?: { value: string; label: string }[]
  ) => {
    try {
      const { data, error } = await supabase
        .from('worker_compliance_fields')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // Save select options if provided
      if (selectOptions !== undefined) {
        await saveSelectOptions(id, selectOptions)
      }

      if (countryNameOrCode) {
        await fetchFieldsForCountry(countryNameOrCode)
      }
      
      return data
    } catch (error) {
      console.error('Error updating worker compliance field:', error)
      throw error
    }
  }

  const deleteField = async (id: string) => {
    try {
      const { error } = await supabase
        .from('worker_compliance_fields')
        .delete()
        .eq('id', id)

      if (error) throw error

      if (countryNameOrCode) {
        await fetchFieldsForCountry(countryNameOrCode)
      }
    } catch (error) {
      console.error('Error deleting worker compliance field:', error)
      throw error
    }
  }

  useEffect(() => {
    if (countryNameOrCode) {
      fetchFieldsForCountry(countryNameOrCode)
    } else {
      setFields([])
      setIsLoading(false)
    }
  }, [countryNameOrCode])

  const refetch = () => {
    if (countryNameOrCode) {
      fetchFieldsForCountry(countryNameOrCode)
    }
  }

  return {
    fields,
    isLoading,
    createField,
    updateField,
    deleteField,
    refetch
  }
}
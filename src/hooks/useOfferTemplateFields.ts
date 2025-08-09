import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface OfferTemplateField {
  id: string
  template_id: string
  field_name: string
  field_label: string
  field_type: 'text' | 'textarea' | 'select' | 'date' | 'number' | 'file' | 'email' | 'checkbox' | 'url'
  is_required: boolean
  display_order: number
  placeholder_text?: string
  help_text?: string
  accepted_file_types?: string
  max_file_size_mb?: number
  created_by?: string
  created_at: string
  updated_at: string
}

export interface FieldSelectOption {
  id: string
  offer_template_field_id?: string
  country_field_id?: string
  option_label: string
  option_value: string
  display_order: number
  created_at: string
}

export interface FieldValidationRule {
  id: string
  offer_template_field_id?: string
  country_field_id?: string
  rule_type: string
  rule_value: string
  error_message: string
  created_at: string
}

export function useOfferTemplateFields(templateId?: string) {
  const [fields, setFields] = useState<OfferTemplateField[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const fetchFields = async () => {
    if (!templateId) {
      setFields([])
      return
    }

    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('offer_template_fields')
        .select('*')
        .eq('template_id', templateId)
        .order('display_order')

      if (error) throw error
      setFields(data || [])
    } catch (error) {
      console.error('Error fetching offer template fields:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch template fields',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const createField = async (fieldData: Omit<OfferTemplateField, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('offer_template_fields')
        .insert(fieldData)
        .select()
        .single()

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Template field created successfully'
      })

      await fetchFields()
      return data
    } catch (error) {
      console.error('Error creating template field:', error)
      toast({
        title: 'Error',
        description: 'Failed to create template field',
        variant: 'destructive'
      })
      throw error
    }
  }

  const updateField = async (id: string, fieldData: Partial<OfferTemplateField>) => {
    try {
      const { error } = await supabase
        .from('offer_template_fields')
        .update(fieldData)
        .eq('id', id)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Template field updated successfully'
      })

      await fetchFields()
    } catch (error) {
      console.error('Error updating template field:', error)
      toast({
        title: 'Error',
        description: 'Failed to update template field',
        variant: 'destructive'
      })
      throw error
    }
  }

  const deleteField = async (id: string) => {
    try {
      const { error } = await supabase
        .from('offer_template_fields')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({
        title: 'Success',
        description: 'Template field deleted successfully'
      })

      await fetchFields()
    } catch (error) {
      console.error('Error deleting template field:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete template field',
        variant: 'destructive'
      })
      throw error
    }
  }

  // Field options management
  const fetchFieldOptions = async (fieldId: string): Promise<FieldSelectOption[]> => {
    try {
      const { data, error } = await supabase
        .from('field_select_options')
        .select('*')
        .eq('offer_template_field_id', fieldId)
        .order('display_order')

      if (error) throw error
      return data || []
    } catch (error) {
      console.error('Error fetching field options:', error)
      return []
    }
  }

  const createFieldOption = async (optionData: {
    offer_template_field_id: string
    option_label: string
    option_value: string
    display_order: number
  }) => {
    try {
      const { data, error } = await supabase
        .from('field_select_options')
        .insert(optionData)
        .select()
        .single()

      if (error) throw error
      return data
    } catch (error) {
      console.error('Error creating field option:', error)
      throw error
    }
  }

  const deleteFieldOption = async (id: string) => {
    try {
      const { error } = await supabase
        .from('field_select_options')
        .delete()
        .eq('id', id)

      if (error) throw error
    } catch (error) {
      console.error('Error deleting field option:', error)
      throw error
    }
  }

  useEffect(() => {
    fetchFields()
  }, [templateId])

  return {
    fields,
    isLoading,
    createField,
    updateField,
    deleteField,
    fetchFieldOptions,
    createFieldOption,
    deleteFieldOption,
    refetchFields: fetchFields
  }
}
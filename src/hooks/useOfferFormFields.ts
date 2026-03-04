import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'

export type { SalaryFieldConfig, LocationFieldConfig, PhoneFieldConfig } from '@/hooks/useJobPostingFields'
import type { SalaryFieldConfig, LocationFieldConfig, PhoneFieldConfig } from '@/hooks/useJobPostingFields'

export interface OfferFormField {
  id: string
  form_id: string
  field_name: string
  field_label: string
  field_type: 'text' | 'textarea' | 'select' | 'date' | 'number' | 'file' | 'email' | 'checkbox' | 'url' | 'salary' | 'location'
  is_required: boolean
  display_order: number
  placeholder_text?: string
  help_text?: string
  accepted_file_types?: string
  max_file_size_mb?: number
  field_config?: SalaryFieldConfig | LocationFieldConfig | null
  created_by?: string
  created_at: string
  updated_at: string
}

export function useOfferFormFields(formId?: string) {
  const [fields, setFields] = useState<OfferFormField[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  const fetchFields = async () => {
    if (!formId) {
      setFields([])
      return
    }

    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('offer_form_fields')
        .select('*')
        .eq('form_id', formId)
        .order('display_order')

      if (error) throw error
      setFields((data || []) as any)
    } catch (error) {
      console.error('Error fetching offer form fields:', error)
      toast({ title: 'Error', description: 'Failed to fetch form fields', variant: 'destructive' })
    } finally {
      setIsLoading(false)
    }
  }

  const createField = async (fieldData: Omit<OfferFormField, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
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
        .from('offer_form_fields')
        .insert(enrichedFieldData as any)
        .select()
        .single()

      if (error) throw error

      toast({ title: 'Success', description: 'Form field created successfully' })
      await fetchFields()
      return data
    } catch (error) {
      console.error('Error creating form field:', error)
      toast({ title: 'Error', description: 'Failed to create form field', variant: 'destructive' })
      throw error
    }
  }

  const updateField = async (id: string, fieldData: Partial<OfferFormField>) => {
    try {
      const { error } = await supabase
        .from('offer_form_fields')
        .update(fieldData as any)
        .eq('id', id)

      if (error) throw error

      toast({ title: 'Success', description: 'Form field updated successfully' })
      await fetchFields()
    } catch (error) {
      console.error('Error updating form field:', error)
      toast({ title: 'Error', description: 'Failed to update form field', variant: 'destructive' })
      throw error
    }
  }

  const deleteField = async (id: string) => {
    try {
      const { error } = await supabase
        .from('offer_form_fields')
        .delete()
        .eq('id', id)

      if (error) throw error

      toast({ title: 'Success', description: 'Form field deleted successfully' })
      await fetchFields()
    } catch (error) {
      console.error('Error deleting form field:', error)
      toast({ title: 'Error', description: 'Failed to delete form field', variant: 'destructive' })
      throw error
    }
  }

  useEffect(() => {
    fetchFields()
  }, [formId])

  return {
    fields,
    isLoading,
    createField,
    updateField,
    deleteField,
    refetchFields: fetchFields
  }
}

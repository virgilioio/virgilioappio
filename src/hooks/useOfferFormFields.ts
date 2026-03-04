import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useToast } from '@/hooks/use-toast'

export type { SalaryFieldConfig, LocationFieldConfig, PhoneFieldConfig } from '@/hooks/useJobPostingFields'
import type { SalaryFieldConfig, LocationFieldConfig, PhoneFieldConfig, SelectOptionData } from '@/hooks/useJobPostingFields'

export interface OfferFormField {
  id: string
  form_id: string
  field_name: string
  field_label: string
  field_type: 'text' | 'textarea' | 'select' | 'date' | 'number' | 'file' | 'email' | 'checkbox' | 'url' | 'salary' | 'location' | 'phone' | 'recruiter'
  is_required: boolean
  display_order: number
  placeholder_text?: string
  help_text?: string
  accepted_file_types?: string
  max_file_size_mb?: number
  field_config?: SalaryFieldConfig | LocationFieldConfig | PhoneFieldConfig | null
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

  const createField = async (fieldData: Omit<OfferFormField, 'id' | 'created_at' | 'updated_at'> & { select_options?: SelectOptionData[] }) => {
    try {
      const { select_options, ...rest } = fieldData as any
      const { data: { user } } = await supabase.auth.getUser()
      const { data: memberData } = await supabase
        .from('members')
        .select('organization_id, user_type')
        .eq('user_id', user?.id)
        .eq('user_status', 'active')
        .single()

      const enrichedFieldData = {
        ...rest,
        organization_id: memberData?.user_type === 'workspace_owner' ? memberData.organization_id : null,
        created_by: user?.id
      }

      const { data, error } = await supabase
        .from('offer_form_fields')
        .insert(enrichedFieldData as any)
        .select()
        .single()

      if (error) throw error

      // Persist select options if provided
      if (select_options?.length && data) {
        const rows = select_options.map((o: SelectOptionData, i: number) => ({
          offer_field_id: data.id,
          option_value: o.option_value,
          option_label: o.option_label,
          display_order: i
        }))
        await supabase.from('offer_field_select_options').insert(rows as any)
      }

      toast({ title: 'Success', description: 'Form field created successfully' })
      await fetchFields()
      return data
    } catch (error) {
      console.error('Error creating form field:', error)
      toast({ title: 'Error', description: 'Failed to create form field', variant: 'destructive' })
      throw error
    }
  }

  const updateField = async (id: string, fieldData: Partial<OfferFormField> & { select_options?: SelectOptionData[] }) => {
    try {
      const { select_options, ...dbUpdates } = fieldData as any
      const { error } = await supabase
        .from('offer_form_fields')
        .update(dbUpdates as any)
        .eq('id', id)

      if (error) throw error

      // Persist select options if provided (delete + re-insert)
      if (select_options !== undefined) {
        await supabase.from('offer_field_select_options').delete().eq('offer_field_id', id)
        if (select_options.length > 0) {
          const rows = select_options.map((o: SelectOptionData, i: number) => ({
            offer_field_id: id,
            option_value: o.option_value,
            option_label: o.option_label,
            display_order: i
          }))
          await supabase.from('offer_field_select_options').insert(rows as any)
        }
      }

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

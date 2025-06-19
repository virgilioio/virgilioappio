
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'
import { CountryField, FieldValidationRule, FieldSelectOption } from './useCountries'

interface CountryFieldWithRelations extends CountryField {
  validation_rules?: FieldValidationRule[]
  select_options?: FieldSelectOption[]
}

export function useCountryFields(countryCode?: string) {
  const [fields, setFields] = useState<CountryFieldWithRelations[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    if (countryCode) {
      fetchFieldsForCountry(countryCode)
    } else {
      setFields([])
      setIsLoading(false)
    }
  }, [countryCode])

  const fetchFieldsForCountry = async (code: string) => {
    try {
      setIsLoading(true)
      
      // Get country ID first
      const { data: country, error: countryError } = await supabase
        .from('countries')
        .select('id')
        .eq('code', code)
        .eq('is_active', true)
        .single()

      if (countryError) throw countryError
      if (!country) {
        setFields([])
        return
      }

      // Get fields with related data
      const { data: fieldsData, error: fieldsError } = await supabase
        .from('country_fields')
        .select(`
          *,
          field_validation_rules(*),
          field_select_options(*)
        `)
        .eq('country_id', country.id)
        .order('display_order')

      if (fieldsError) throw fieldsError

      setFields(fieldsData?.map(field => ({
        ...field,
        validation_rules: field.field_validation_rules || [],
        select_options: field.field_select_options?.sort((a, b) => a.display_order - b.display_order) || []
      })) || [])
    } catch (error) {
      console.error('Error fetching country fields:', error)
      toast({
        title: 'Error',
        description: 'Failed to load country-specific fields',
        variant: 'destructive'
      })
      setFields([])
    } finally {
      setIsLoading(false)
    }
  }

  const createField = async (fieldData: Omit<CountryField, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
    try {
      const { data, error } = await supabase
        .from('country_fields')
        .insert([fieldData])
        .select()
        .single()

      if (error) throw error

      // Refetch to get updated list
      if (countryCode) {
        await fetchFieldsForCountry(countryCode)
      }

      toast({
        title: 'Success',
        description: 'Field created successfully'
      })
      return data
    } catch (error) {
      console.error('Error creating field:', error)
      toast({
        title: 'Error',
        description: 'Failed to create field',
        variant: 'destructive'
      })
      throw error
    }
  }

  const updateField = async (id: string, updates: Partial<CountryField>) => {
    try {
      const { data, error } = await supabase
        .from('country_fields')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      // Refetch to get updated list
      if (countryCode) {
        await fetchFieldsForCountry(countryCode)
      }

      toast({
        title: 'Success',
        description: 'Field updated successfully'
      })
      return data
    } catch (error) {
      console.error('Error updating field:', error)
      toast({
        title: 'Error',
        description: 'Failed to update field',
        variant: 'destructive'
      })
      throw error
    }
  }

  const deleteField = async (id: string) => {
    try {
      const { error } = await supabase
        .from('country_fields')
        .delete()
        .eq('id', id)

      if (error) throw error

      setFields(prev => prev.filter(field => field.id !== id))
      toast({
        title: 'Success',
        description: 'Field deleted successfully'
      })
    } catch (error) {
      console.error('Error deleting field:', error)
      toast({
        title: 'Error',
        description: 'Failed to delete field',
        variant: 'destructive'
      })
      throw error
    }
  }

  return {
    fields,
    isLoading,
    createField,
    updateField,
    deleteField,
    refetch: () => countryCode ? fetchFieldsForCountry(countryCode) : Promise.resolve()
  }
}

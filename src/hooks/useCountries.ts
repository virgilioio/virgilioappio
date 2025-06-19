
import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

export interface Country {
  id: string
  name: string
  code: string
  is_active: boolean
  created_at: string
  updated_at: string
  created_by?: string
}

export interface CountryField {
  id: string
  country_id: string
  field_name: string
  field_label: string
  field_type: 'text' | 'number' | 'email' | 'textarea' | 'select' | 'checkbox' | 'date' | 'file'
  is_required: boolean
  display_order: number
  placeholder_text?: string
  help_text?: string
  accepted_file_types?: string // JSON array of MIME types
  max_file_size_mb?: number
  created_at: string
  updated_at: string
  created_by?: string
}

export interface FieldValidationRule {
  id: string
  country_field_id: string
  rule_type: string
  rule_value: string
  error_message: string
  created_at: string
}

export interface FieldSelectOption {
  id: string
  country_field_id: string
  option_value: string
  option_label: string
  display_order: number
  created_at: string
}

export function useCountries() {
  const [countries, setCountries] = useState<Country[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()

  useEffect(() => {
    fetchCountries()
  }, [])

  const fetchCountries = async () => {
    try {
      const { data, error } = await supabase
        .from('countries')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) throw error
      setCountries(data || [])
    } catch (error) {
      console.error('Error fetching countries:', error)
      toast({
        title: 'Error',
        description: 'Failed to load countries',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const createCountry = async (countryData: Omit<Country, 'id' | 'created_at' | 'updated_at' | 'created_by'>) => {
    try {
      const { data, error } = await supabase
        .from('countries')
        .insert([countryData])
        .select()
        .single()

      if (error) throw error

      setCountries(prev => [...prev, data])
      toast({
        title: 'Success',
        description: 'Country created successfully'
      })
      return data
    } catch (error) {
      console.error('Error creating country:', error)
      toast({
        title: 'Error',
        description: 'Failed to create country',
        variant: 'destructive'
      })
      throw error
    }
  }

  const updateCountry = async (id: string, updates: Partial<Country>) => {
    try {
      const { data, error } = await supabase
        .from('countries')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      setCountries(prev => prev.map(country => 
        country.id === id ? data : country
      ))
      toast({
        title: 'Success',
        description: 'Country updated successfully'
      })
      return data
    } catch (error) {
      console.error('Error updating country:', error)
      toast({
        title: 'Error',
        description: 'Failed to update country',
        variant: 'destructive'
      })
      throw error
    }
  }

  const deleteCountry = async (id: string) => {
    try {
      const { error } = await supabase
        .from('countries')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error

      setCountries(prev => prev.filter(country => country.id !== id))
      toast({
        title: 'Success',
        description: 'Country deactivated successfully'
      })
    } catch (error) {
      console.error('Error deactivating country:', error)
      toast({
        title: 'Error',
        description: 'Failed to deactivate country',
        variant: 'destructive'
      })
      throw error
    }
  }

  return {
    countries,
    isLoading,
    createCountry,
    updateCountry,
    deleteCountry,
    refetch: fetchCountries
  }
}

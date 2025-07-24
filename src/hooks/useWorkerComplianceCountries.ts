import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'

export interface WorkerComplianceCountry {
  id: string
  name: string
  code: string
  is_active: boolean
  description?: string
  created_by?: string
  created_at: string
  updated_at: string
}

export function useWorkerComplianceCountries() {
  const [countries, setCountries] = useState<WorkerComplianceCountry[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchCountries = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('worker_compliance_countries')
        .select('*')
        .eq('is_active', true)
        .order('name')

      if (error) {
        console.error('Error fetching worker compliance countries:', error)
        return
      }

      setCountries(data || [])
    } catch (error) {
      console.error('Unexpected error fetching worker compliance countries:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const createCountry = async (countryData: Omit<WorkerComplianceCountry, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      const { data, error } = await supabase
        .from('worker_compliance_countries')
        .insert(countryData)
        .select()
        .single()

      if (error) throw error

      await fetchCountries()
      return data
    } catch (error) {
      console.error('Error creating worker compliance country:', error)
      throw error
    }
  }

  const updateCountry = async (id: string, updates: Partial<WorkerComplianceCountry>) => {
    try {
      const { data, error } = await supabase
        .from('worker_compliance_countries')
        .update(updates)
        .eq('id', id)
        .select()
        .single()

      if (error) throw error

      await fetchCountries()
      return data
    } catch (error) {
      console.error('Error updating worker compliance country:', error)
      throw error
    }
  }

  const deleteCountry = async (id: string) => {
    try {
      const { error } = await supabase
        .from('worker_compliance_countries')
        .update({ is_active: false })
        .eq('id', id)

      if (error) throw error

      await fetchCountries()
    } catch (error) {
      console.error('Error deactivating worker compliance country:', error)
      throw error
    }
  }

  useEffect(() => {
    fetchCountries()
  }, [])

  return {
    countries,
    isLoading,
    createCountry,
    updateCountry,
    deleteCountry,
    refetch: fetchCountries
  }
}
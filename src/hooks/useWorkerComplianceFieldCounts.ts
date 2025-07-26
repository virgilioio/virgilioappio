import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'

export function useWorkerComplianceFieldCounts() {
  const [fieldCounts, setFieldCounts] = useState<Record<string, number>>({})
  const [isLoading, setIsLoading] = useState(true)

  const fetchFieldCounts = async () => {
    try {
      setIsLoading(true)
      
      // Get all worker compliance fields with their country information
      const { data, error } = await supabase
        .from('worker_compliance_fields')
        .select(`
          id,
          worker_country_id,
          worker_compliance_countries!inner(
            id,
            code,
            name
          )
        `)

      if (error) {
        console.error('Error fetching worker compliance field counts:', error)
        return
      }

      // Count fields by country code
      const counts: Record<string, number> = {}
      data?.forEach(field => {
        const countryCode = field.worker_compliance_countries?.code
        if (countryCode) {
          counts[countryCode] = (counts[countryCode] || 0) + 1
        }
      })

      setFieldCounts(counts)
    } catch (error) {
      console.error('Unexpected error fetching field counts:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchFieldCounts()
  }, [])

  return {
    fieldCounts,
    isLoading,
    refetch: fetchFieldCounts
  }
}
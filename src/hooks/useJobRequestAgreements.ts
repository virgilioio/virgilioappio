
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/integrations/supabase/client'
import { useToast } from '@/hooks/use-toast'

interface JobRequestAgreement {
  id: string
  country_id: string
  agreement_content: string | null
  version: number
  is_active: boolean
  created_by: string | null
  created_at: string
  updated_at: string
  countries?: {
    name: string
    code: string
  }
}

export function useJobRequestAgreements() {
  const [agreements, setAgreements] = useState<JobRequestAgreement[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const { toast } = useToast()

  const fetchAgreements = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from('job_request_agreements')
        .select(`
          *,
          countries (
            name,
            code
          )
        `)
        .order('created_at', { ascending: false })

      if (error) throw error

      setAgreements(data || [])
    } catch (error) {
      console.error('Error fetching job request agreements:', error)
      toast({
        title: 'Error',
        description: 'Failed to fetch job request agreements',
        variant: 'destructive'
      })
    } finally {
      setIsLoading(false)
    }
  }

  const getAgreementByCountry = useCallback((countryId: string) => {
    return agreements.find(agreement => 
      agreement.country_id === countryId && agreement.is_active
    )
  }, [agreements])

  const createOrUpdateAgreement = async (
    countryId: string, 
    content: string, 
    existingAgreementId?: string
  ) => {
    try {
      setIsUpdating(true)
      
      if (existingAgreementId) {
        // Update existing agreement
        const { error } = await supabase
          .from('job_request_agreements')
          .update({
            agreement_content: content,
            version: supabase.sql`version + 1`,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAgreementId)

        if (error) throw error
      } else {
        // Create new agreement
        const { error } = await supabase
          .from('job_request_agreements')
          .insert({
            country_id: countryId,
            agreement_content: content,
            created_by: (await supabase.auth.getUser()).data.user?.id
          })

        if (error) throw error
      }

      toast({
        title: 'Success',
        description: 'Job request agreement saved successfully'
      })

      await fetchAgreements()
      return true
    } catch (error: any) {
      console.error('Error saving job request agreement:', error)
      toast({
        title: 'Save Failed',
        description: error.message || 'Failed to save job request agreement',
        variant: 'destructive'
      })
      return false
    } finally {
      setIsUpdating(false)
    }
  }

  useEffect(() => {
    fetchAgreements()
  }, [])

  return {
    agreements,
    isLoading,
    isUpdating,
    getAgreementByCountry,
    createOrUpdateAgreement,
    refetchAgreements: fetchAgreements
  }
}

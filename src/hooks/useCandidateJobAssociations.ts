import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from 'sonner'

export interface CandidateJobAssociation {
  id: string
  job_id: string
  status: string | null
  current_stage_id: string | null
  job: {
    id: string
    title: string
    organization: {
      name: string
    } | null
  }
}

export function useCandidateJobAssociations(candidateId: string | null) {
  const [jobAssociations, setJobAssociations] = useState<CandidateJobAssociation[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchAssociations = async () => {
    if (!candidateId) {
      setJobAssociations([])
      return
    }

    setIsLoading(true)
    try {
      const { data, error } = await supabase
        .from('job_candidate_associations')
        .select(`
          id,
          job_id,
          status,
          current_stage_id,
          job:jobs!inner (
            id,
            title,
            organization:organizations (
              name
            )
          )
        `)
        .eq('candidate_id', candidateId)
        .order('created_at', { ascending: false })

      if (error) throw error

      setJobAssociations(data || [])
    } catch (error) {
      console.error('Error fetching candidate job associations:', error)
      toast.error('Failed to load job associations')
      setJobAssociations([])
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchAssociations()
  }, [candidateId])

  return {
    jobAssociations,
    isLoading,
    refetch: fetchAssociations
  }
}

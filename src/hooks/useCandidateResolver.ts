import { useState, useEffect } from 'react'
import { supabase } from '@/integrations/supabase/client'

interface CandidateResolver {
  independentCandidateId: string | null
  isLoading: boolean
  error: string | null
}

/**
 * Hook to resolve job candidate IDs to independent candidate IDs
 * This is needed because attachments are linked to the independent candidates table,
 * but job-specific views use the job_candidates table
 */
export function useCandidateResolver(jobCandidateId: string | null): CandidateResolver {
  const [independentCandidateId, setIndependentCandidateId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const resolveCandidate = async () => {
      if (!jobCandidateId) {
        setIndependentCandidateId(null)
        return
      }

      setIsLoading(true)
      setError(null)

      try {
        // First, check if this is already an independent candidate ID
        const { data: independentCandidate, error: independentError } = await supabase
          .from('candidates')
          .select('id')
          .eq('id', jobCandidateId)
          .maybeSingle()

        if (independentCandidate) {
          // This is already an independent candidate ID
          setIndependentCandidateId(jobCandidateId)
          return
        }

        // If not, try to find the job candidate and resolve it
        const { data: jobCandidate, error: jobError } = await supabase
          .from('job_candidates')
          .select('candidate_name, linkedin_url, location_country, location_city')
          .eq('id', jobCandidateId)
          .single()

        if (jobError) {
          throw jobError
        }

        if (!jobCandidate) {
          setIndependentCandidateId(null)
          return
        }

        // Try to find a matching independent candidate
        let query = supabase.from('candidates').select('id')

        // Try to match by LinkedIn URL first (most reliable)
        if (jobCandidate.linkedin_url) {
          const { data: linkedInMatch } = await query
            .eq('linkedin_url', jobCandidate.linkedin_url)
            .maybeSingle()
          
          if (linkedInMatch) {
            setIndependentCandidateId(linkedInMatch.id)
            return
          }
        }

        // Fall back to matching by name and location
        const { data: nameLocationMatch } = await supabase
          .from('candidates')
          .select('id')
          .eq('candidate_name', jobCandidate.candidate_name)
          .eq('location_country', jobCandidate.location_country || '')
          .eq('location_city', jobCandidate.location_city || '')
          .maybeSingle()

        if (nameLocationMatch) {
          setIndependentCandidateId(nameLocationMatch.id)
          return
        }

        // No match found
        setIndependentCandidateId(null)

      } catch (err) {
        console.error('Error resolving candidate ID:', err)
        setError(err instanceof Error ? err.message : 'Failed to resolve candidate')
        setIndependentCandidateId(null)
      } finally {
        setIsLoading(false)
      }
    }

    resolveCandidate()
  }, [jobCandidateId])

  return {
    independentCandidateId,
    isLoading,
    error
  }
}
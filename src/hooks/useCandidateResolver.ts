import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

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
          // This is already an independent candidate ID - use it directly
          setIndependentCandidateId(jobCandidateId)
          return
        }

        // If not found in candidates table, this ID is invalid
        // (legacy job_candidates table is deprecated and should not be used)
        console.warn(`Candidate ID ${jobCandidateId} not found in candidates table`)
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
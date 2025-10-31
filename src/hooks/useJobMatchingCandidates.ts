import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'

export interface MatchedCandidate {
  id: string
  candidate_name: string
  skills?: string[]
  standardized_skills?: string[]
  location_country?: string | null
  location_state?: string | null
  location_city?: string | null
  linkedin_url?: string
  salary_amount?: number
  salary_currency?: string
  salary_period?: string
  match_score: number
  match_tier: 'excellent' | 'good' | 'fair' | 'minimal'
  profile_summary?: string | null
  source: 'local' | 'coresignal'
  years_experience?: number
  enriched_at?: string | null
  current_company?: string
  current_role?: string
  created_at: string
  first_viewed_by?: Record<string, string> | null
  // CoreSignal-specific fields
  coresignal_id?: string
  coresignal_score?: number
  headline?: string
  candidate_id?: string | null // Null if not collected yet
}

export interface JobMatchingResult {
  candidates: MatchedCandidate[]
  total_count: number
  breakdown: {
    localCandidates: number
    coreSignalCandidates: number
    averageMatch: number
    creditsUsed?: number
    collectCreditsUsed?: number
  }
}

interface UseJobMatchingCandidatesParams {
  jobId: string
  limit?: number
  enabled?: boolean
  jobSkills?: string[] | null // Add skills to trigger refresh when they change
}

export function useJobMatchingCandidates({
  jobId,
  limit = 50,
  enabled = true,
  jobSkills
}: UseJobMatchingCandidatesParams) {
  const [matchingResult, setMatchingResult] = useState<JobMatchingResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Create a stable hash of job skills to detect changes
  const skillsHash = useMemo(() => {
    if (!jobSkills || !Array.isArray(jobSkills)) return ''
    return jobSkills.slice().sort().join('|')
  }, [jobSkills])

  const fetchMatchingCandidates = useCallback(async () => {
    if (!enabled || !jobId) {
      setMatchingResult(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log(`🎯 Fetching matching candidates for job: ${jobId}`)

      const { data, error } = await supabase.functions.invoke('get-job-matching-candidates', {
        body: {
          job_id: jobId,
          limit
        }
      })

      if (error) throw error

      console.log(`✅ Found ${data.candidates?.length || 0} matching candidates`)
      setMatchingResult(data)
    } catch (err: any) {
      console.error('Error fetching matching candidates:', err)
      setError(err.message || 'Failed to fetch matching candidates')
    } finally {
      setIsLoading(false)
    }
  }, [jobId, limit, enabled])

  useEffect(() => {
    fetchMatchingCandidates()
  }, [fetchMatchingCandidates])

  // Separate effect to handle skills changes with debouncing
  useEffect(() => {
    if (!enabled || !jobId) return

    const timeoutId = setTimeout(() => {
      console.log('🔄 Job skills changed, refreshing matching candidates...')
      fetchMatchingCandidates()
    }, 300) // 300ms debounce to prevent excessive API calls

    return () => clearTimeout(timeoutId)
  }, [skillsHash, enabled, jobId, fetchMatchingCandidates])

  const refetch = useCallback(() => {
    fetchMatchingCandidates()
  }, [fetchMatchingCandidates])

  return {
    matchingResult,
    candidates: matchingResult?.candidates || [],
    isLoading,
    error,
    refetch
  }
}
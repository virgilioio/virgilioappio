import { useState, useEffect, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabaseClient'

export interface SuggestedCandidate {
  id: string
  candidate_name: string
  skills?: string[]
  standardized_skills?: string[]
  location?: string | null
  location_country?: string | null
  location_state?: string | null
  location_city?: string | null
  linkedin_url?: string
  salary_amount?: number
  salary_currency?: string
  salary_period?: string
  years_experience?: number
  current_company?: string
  current_role?: string
  source: 'local'
  created_at: string
  enriched_at?: string | null
  first_viewed_by?: Record<string, string> | null
  profile_summary?: string | null
  ai_fit_score: number
  ai_fit_confidence?: string
  ai_fit_rationale?: string
  // Backward compat
  match_score?: number
  match_tier?: string
  candidate_id?: string
}

interface UseJobSuggestedCandidatesParams {
  jobId: string
  limit?: number
  enabled?: boolean
  jobSkills?: string[] | null
}

export function useJobSuggestedCandidates({
  jobId,
  limit = 25,
  enabled = true,
  jobSkills
}: UseJobSuggestedCandidatesParams) {
  const [candidates, setCandidates] = useState<SuggestedCandidate[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const skillsHash = useMemo(() => {
    if (!jobSkills || !Array.isArray(jobSkills)) return ''
    return jobSkills.slice().sort().join('|')
  }, [jobSkills])

  const fetchSuggested = useCallback(async () => {
    if (!enabled || !jobId) {
      setCandidates([])
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log(`🎯 Fetching AI-suggested candidates for job: ${jobId}`)

      const { data, error } = await supabase.functions.invoke('get-suggested-candidates', {
        body: { job_id: jobId, limit }
      })

      if (error) throw error

      console.log(`✅ Found ${data.candidates?.length || 0} AI-suggested candidates`)
      setCandidates(data.candidates || [])
    } catch (err: any) {
      console.error('Error fetching suggested candidates:', err)
      setError(err.message || 'Failed to fetch suggested candidates')
    } finally {
      setIsLoading(false)
    }
  }, [jobId, limit, enabled])

  useEffect(() => {
    fetchSuggested()
  }, [fetchSuggested])

  // Refresh when skills change
  useEffect(() => {
    if (!enabled || !jobId) return
    const timeoutId = setTimeout(() => {
      console.log('🔄 Job skills changed, refreshing suggested candidates...')
      fetchSuggested()
    }, 300)
    return () => clearTimeout(timeoutId)
  }, [skillsHash, enabled, jobId, fetchSuggested])

  return {
    candidates,
    isLoading,
    error,
    refetch: fetchSuggested
  }
}

// Count-only version for tab badge
export function useJobSuggestedCandidatesCount({
  jobId,
  enabled = true
}: { jobId: string; enabled?: boolean }) {
  const [count, setCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!enabled || !jobId) {
      setCount(0)
      return
    }

    const fetchCount = async () => {
      setIsLoading(true)
      try {
        const { data, error } = await supabase.functions.invoke('get-suggested-candidates', {
          body: { job_id: jobId, count_only: true }
        })
        if (error) throw error
        setCount(data?.total_count || 0)
      } catch (err) {
        console.error('Error fetching suggested count:', err)
      } finally {
        setIsLoading(false)
      }
    }

    fetchCount()
  }, [jobId, enabled])

  return { count, isLoading }
}

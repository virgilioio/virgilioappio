import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { SearchCriteria } from '@/types/sourcing'

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
  candidate_id?: string | null
  industry?: string
  connections_count?: number
  follower_count?: number
  company_url?: string
  company_website?: string
  company_industry?: string
  experience_location?: string
}

export interface SourcingProjectMatchingResult {
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

interface UseSourcingProjectCandidatesParams {
  projectId: string
  limit?: number
  enabled?: boolean
}

export function useSourcingProjectCandidates({
  projectId,
  limit = 50,
  enabled = true
}: UseSourcingProjectCandidatesParams) {
  const [matchingResult, setMatchingResult] = useState<SourcingProjectMatchingResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchMatchingCandidates = useCallback(async () => {
    if (!enabled || !projectId) {
      setMatchingResult(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      console.log(`🎯 Fetching matching candidates for sourcing project: ${projectId}`)

      const { data, error } = await supabase.functions.invoke('get-job-matching-candidates', {
        body: {
          sourcing_project_id: projectId,
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
  }, [projectId, limit, enabled])

  useEffect(() => {
    fetchMatchingCandidates()
  }, [fetchMatchingCandidates])

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

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
  source: 'local' | 'apollo'
  years_experience?: number
  experience_years?: number
  enriched_at?: string | null
  current_company?: string
  current_role?: string
  created_at: string
  first_viewed_by?: Record<string, string> | null
  // Apollo-specific fields
  apollo_id?: string
  apollo_score?: number
  headline?: string
  email?: string
  email_status?: string
  phone?: string
  candidate_id?: string | null
  industry?: string
  connections_count?: number
  follower_count?: number
  company_url?: string
  company_website?: string
  company_industry?: string
  experience_location?: string
  // Apollo availability indicators (indicate what CAN be revealed after collection)
  has_email?: boolean
  has_phone?: boolean
  has_location?: boolean
  // LOCAL KEYWORD SCORING - transparent matching
  keyword_score?: number
  matched_keywords?: string[]
}

export interface SourcingProjectMatchingResult {
  candidates: MatchedCandidate[]
  total_count: number
  breakdown: {
    localCandidates: number
    apolloCandidates: number
    averageMatch: number
    creditsUsed?: number
    collectCreditsUsed?: number
  }
  // TRANSPARENT SEARCH METADATA - shows keyword scoring results
  search_metadata?: {
    search_expanded?: boolean
    expanded_steps?: string[]
    result_pool_size?: number
    returned_count?: number
    overflow_warning?: boolean
    title_match_rate?: number
    fallback_trigger_reason?: string | null
    has_user_companies?: boolean
    // KEYWORD STATS - transparent local scoring
    keyword_stats?: {
      keywords_searched: string[]
      total_candidates: number
      keyword_match_count: number
      keyword_match_rate: number
    }
  }
}

interface UseSourcingProjectCandidatesParams {
  projectId: string
  limit?: number  // Default: 500 for sourcing projects
  enabled?: boolean
}

export function useSourcingProjectCandidates({
  projectId,
  limit = 500,
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

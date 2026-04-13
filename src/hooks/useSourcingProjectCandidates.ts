import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabaseClient'
import type { SearchCriteria } from '@/types/sourcing'

export interface PdlExperience {
  company?: string
  title?: string
  start_date?: string
  end_date?: string
  is_current?: boolean
  location?: string
  summary?: string
  company_size?: string
  company_industry?: string
}

export interface PdlEducation {
  school?: string
  degree?: string
  field_of_study?: string
  start_date?: string
  end_date?: string
}

export interface PdlCertification {
  name?: string
  organization?: string
}

export interface MatchedCandidate {
  id: string
  candidate_name?: string
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
  source: 'local' | 'apollo' | 'pdl'
  years_experience?: number
  experience_years?: number
  enriched_at?: string | null
  current_company?: string
  current_role?: string
  created_at?: string
  first_viewed_by?: Record<string, string> | null
  // PDL-specific fields
  is_preview?: boolean
  needs_enrichment?: boolean
  pdl_id?: string
  summary?: string
  full_name?: string
  // PDL rich data arrays
  experience?: PdlExperience[]
  education?: PdlEducation[]
  certifications?: PdlCertification[]
  job_title_levels?: string[]
  github_url?: string
  twitter_url?: string
  website_url?: string
  emails?: { address: string; type?: string }[]
  phones?: { number: string; type?: string }[]
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
    pdlCandidates?: number
    averageMatch: number
    creditsUsed?: number
    collectCreditsUsed?: number
  }
  // Source breakdown from API
  source_breakdown?: {
    pdl: number
    apollo: number
    full_data: number
    preview_only: number
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
  const isFetchingRef = useRef(false)

  const fetchMatchingCandidates = useCallback(async () => {
    if (!enabled || !projectId) {
      setMatchingResult(null)
      return
    }

    // Guard against concurrent/duplicate calls
    if (isFetchingRef.current) {
      console.log('⏳ Skipping duplicate sourcing-search call (already in progress)')
      return
    }

    isFetchingRef.current = true
    setIsLoading(true)
    setError(null)

    try {
      console.log(`🎯 Fetching matching candidates for sourcing project: ${projectId}`)

      const { data, error } = await supabase.functions.invoke('sourcing-search', {
        body: {
          sourcing_project_id: projectId,
          limit,
          pdl_limit: 5
        }
      })

      if (error) throw error

      console.log(`✅ Found ${data.candidates?.length || 0} matching candidates (sources: PDL ${data.source_breakdown?.pdl ?? 0}, Apollo ${data.source_breakdown?.apollo ?? 0})`)
      setMatchingResult({
        candidates: data.candidates || [],
        total_count: data.candidates?.length || 0,
        breakdown: {
          localCandidates: 0,
          apolloCandidates: data.source_breakdown?.apollo ?? 0,
          pdlCandidates: data.source_breakdown?.pdl ?? 0,
          averageMatch: 0,
        },
        source_breakdown: data.source_breakdown,
        search_metadata: data.search_metadata,
      })
    } catch (err: any) {
      console.error('Error fetching matching candidates:', err)
      setError(err.message || 'Failed to fetch matching candidates')
    } finally {
      isFetchingRef.current = false
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

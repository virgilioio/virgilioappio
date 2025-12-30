export interface ResearchMetadata {
  researched_titles?: string[]
  researched_companies?: string[]
  researched_industries?: string[]
  researched_keywords?: string[]
  research_reasoning?: string
  research_timestamp?: string
}

export interface JobSpecData {
  job_title: string
  alt_titles?: string[]
  job_description?: string
  level?: string
  department?: string
  location?: string
  location_details?: {
    city?: string
    state?: string
    country_code?: string
    region?: string
    is_remote?: boolean
  }
  salary_range?: {
    min: number
    max: number
    currency: string
    period?: string
  }
  skills?: string[]
  recommendations?: string[]
  research_metadata?: ResearchMetadata
}

export interface SourcingProject {
  id: string
  organization_id: string
  created_by: string
  job_id: string | null
  name: string
  description: string | null
  status: 'active' | 'archived'
  search_criteria: SearchCriteria
  enabled_sources: EnabledSource[]
  total_candidates: number
  last_search_at: string | null
  is_public: boolean
  created_at: string
  updated_at: string
  job_spec_data?: JobSpecData | null  // Full AI-generated job specification
  
  // Joined relations
  jobs?: {
    id: string
    title: string
    status: string
    organization_id: string
    organizations?: { name: string }
  } | null
}

export interface SearchCriteria {
  skills: string[]  // Note: Skills are NOT used by Apollo - they filter by title instead
  locations?: string[] // Array of location values: "city,state,country" or "state,country" or "country"
  title_keywords?: string[]
  experience_years?: {
    min?: number
    max?: number
  }
  education_level?: string
  // Apollo-specific filters
  seniorities?: string[]  // 'entry', 'senior', 'manager', 'director', 'vp', 'c_suite', 'owner', 'founder', 'partner', 'head', 'intern'
  keywords?: string[]  // General keyword search (q_keywords) - joined with spaces for Apollo
  company_sizes?: string[]  // '1-10', '11-50', '51-200', '201-500', '501-1000', '1001-5000', '5001-10000', '10001+'
  company_domains?: string[]  // Target company domains for filtering
  // Separated company fields for constraint budgeting
  user_company_names?: string[]  // User-mentioned companies (hard constraint, max 5)
  researched_companies?: string[]  // AI-suggested companies (soft boosters, max 3)
  company_names?: string[]  // Legacy: Target company names for filtering (q_organization_name)
  industries?: string[]  // Industry/sector filter - DEPRECATED, always empty
  // Research metadata - populated by AI research
  research_metadata?: {
    researched_titles?: string[]
    researched_companies?: string[]
    researched_industries?: string[]
    researched_keywords?: string[]
    research_reasoning?: string
    research_timestamp?: string
  }
}

// Search metadata for progressive relaxation feedback
export interface SearchMetadata {
  search_expanded: boolean
  expanded_steps: Array<
    | 'dropped_booster_companies'
    | 'dropped_keywords'
    | 'dropped_seniorities'
    | 'broadened_location'
  >
  result_pool_size: number    // Apollo total_count from winning search
  returned_count: number      // Actual candidates returned after merge/dedupe
  overflow_warning: boolean   // True if result_pool_size > 500
  title_match_rate?: number   // Percentage of candidates with matching titles
  fallback_trigger_reason?: 'zero_results' | 'low_quality' | null
  has_user_companies?: boolean  // For context-aware UI copy
}

export type EnabledSource = 'internal' | 'apollo' | 'linkedin' | 'seekout'

export interface SourcingProjectFilters {
  matchTiers?: ('excellent' | 'good' | 'fair' | 'minimal')[]
  minExperience?: number
  maxExperience?: number
  source?: 'local' | 'apollo' | 'all'
  hasEmail?: boolean
  hasPhone?: boolean
}

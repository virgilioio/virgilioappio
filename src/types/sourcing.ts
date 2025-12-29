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
  company_names?: string[]  // Target company names for filtering (q_organization_name)
  industries?: string[]  // Industry/sector filter (organization_industry_tag_ids)
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

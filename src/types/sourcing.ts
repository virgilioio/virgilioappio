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
  created_at: string
  updated_at: string
  
  // Joined relations
  jobs?: {
    id: string
    title: string
    status: string
    organization_id: string
  } | null
}

export interface SearchCriteria {
  skills: string[]
  locations?: string[]
  title_keywords?: string[]
  salary_min?: number
  salary_max?: number
  currency?: string
  experience_years?: {
    min?: number
    max?: number
  }
  education_level?: string
}

export type EnabledSource = 'internal' | 'coresignal' | 'linkedin' | 'seekout'

export interface SourcingProjectFilters {
  matchTiers?: ('excellent' | 'good' | 'fair' | 'minimal')[]
  location?: string
  minExperience?: number
  maxExperience?: number
  source?: 'local' | 'coresignal' | 'all'
}

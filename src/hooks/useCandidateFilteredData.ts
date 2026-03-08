import { useMemo } from 'react'
import type { IndependentCandidate } from './useIndependentCandidates'
import type { CandidateFilters } from '@/contexts/CandidateFilterContext'

function normalizeAnnualSalary(amount: number, period?: string | null): number {
  switch (period?.toLowerCase()) {
    case 'hourly': return amount * 2080
    case 'monthly': return amount * 12
    case 'weekly': return amount * 52
    case 'daily': return amount * 260
    default: return amount
  }
}

export function useCandidateFilteredData(
  candidates: IndependentCandidate[],
  filters: CandidateFilters,
  searchTerm: string
) {
  return useMemo(() => {
    return candidates.filter(c => {
      // Text search
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        const matchesSearch =
          c.candidate_name.toLowerCase().includes(term) ||
          (c.email && c.email.toLowerCase().includes(term))
        if (!matchesSearch) return false
      }

      // Array filters
      if (filters.statuses.length > 0 && !filters.statuses.includes(c.status)) return false
      if (filters.sources.length > 0 && !filters.sources.includes(c.source)) return false
      if (filters.countries.length > 0 && (!c.location_country || !filters.countries.includes(c.location_country))) return false
      if (filters.states.length > 0 && (!c.location_state || !filters.states.includes(c.location_state))) return false
      if (filters.cities.length > 0 && (!c.location_city || !filters.cities.includes(c.location_city))) return false
      if (filters.seniorityLevels.length > 0 && (!c.seniority_level || !filters.seniorityLevels.includes(c.seniority_level))) return false
      if (filters.functionalAreas.length > 0 && (!c.functional_area || !filters.functionalAreas.includes(c.functional_area))) return false
      if (filters.specializations.length > 0 && (!c.specialization || !filters.specializations.includes(c.specialization))) return false
      if (filters.enrichmentStatuses.length > 0 && (!c.enrichment_status || !filters.enrichmentStatuses.includes(c.enrichment_status))) return false

      // Skills filter (match any)
      if (filters.skills.length > 0) {
        const candidateSkills = c.standardized_skills?.length ? c.standardized_skills : c.skills
        if (!candidateSkills || !filters.skills.some(s => candidateSkills.includes(s))) return false
      }

      // Experience range
      if (filters.experienceMin !== null && (c.years_experience == null || c.years_experience < filters.experienceMin)) return false
      if (filters.experienceMax !== null && (c.years_experience == null || c.years_experience > filters.experienceMax)) return false

      // Salary range
      if (filters.salaryMin !== null || filters.salaryMax !== null) {
        if (c.salary_amount == null || c.salary_amount <= 0) return false
        const annual = normalizeAnnualSalary(c.salary_amount, c.salary_period)
        if (filters.salaryMin !== null && annual < filters.salaryMin) return false
        if (filters.salaryMax !== null && annual > filters.salaryMax) return false
      }

      // Date range
      if (filters.dateFrom !== null) {
        const created = new Date(c.created_at)
        if (created < filters.dateFrom) return false
      }
      if (filters.dateTo !== null) {
        const created = new Date(c.created_at)
        if (created > filters.dateTo) return false
      }

      return true
    })
  }, [candidates, filters, searchTerm])
}

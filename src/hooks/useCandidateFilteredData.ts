import { useMemo } from 'react'
import type { IndependentCandidate } from './useIndependentCandidates'
import type { CandidateFilters } from '@/contexts/CandidateFilterContext'
import type { AssociationsMap } from './useCandidateJobAssociations'
import { buildSearchText, matchesEverything, queryWords, type SearchText } from '@/lib/candidateSearch'
import { datesFor, inRange } from '@/lib/candidateDates'

/** One searchable text per candidate (name, emails, phones, title, skills, summary, tags…). */
export function useCandidateSearchTexts(
  candidates: IndependentCandidate[],
  candidateTagsMap?: Map<string, string[]>,
  tagNames?: Map<string, string>,
) {
  return useMemo(() => {
    const map = new Map<string, SearchText>()
    for (const c of candidates) {
      const names = (candidateTagsMap?.get(c.id) ?? []).map((id) => tagNames?.get(id)).filter((n): n is string => !!n)
      map.set(c.id, buildSearchText(c as any, names))
    }
    return map
  }, [candidates, candidateTagsMap, tagNames])
}

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
  searchTerm: string,
  associationsMap?: AssociationsMap,
  candidateTagsMap?: Map<string, string[]>,
  searchTexts?: Map<string, SearchText>,
  interviewsMap?: Map<string, number[]>,
) {
  return useMemo(() => {
    // Every word has to appear somewhere: "SDR Mexico" finds an SDR in Mexico.
    const words = searchTerm.trim() ? queryWords(searchTerm) : []
    const now = Date.now()
    return candidates.filter(c => {
      // Tag filter — candidate must have at least one selected tag
      if (filters.tagIds && filters.tagIds.length > 0) {
        const ctags = candidateTagsMap?.get(c.id)
        if (!ctags || !ctags.some(id => filters.tagIds.includes(id))) return false
      }


      // Text search (Everything mode)
      if (words.length > 0) {
        const text = searchTexts?.get(c.id)
        if (!text || !matchesEverything(text, words)) return false
      }


      // Array filters
      if (filters.statuses.length > 0 && !filters.statuses.includes(c.status)) return false
      if (filters.sources.length > 0 && !filters.sources.includes(c.source)) return false
      if (filters.countries.length > 0 && (!c.location_country || !filters.countries.includes(c.location_country))) return false
      if (filters.states.length > 0 && (!c.location_state || !filters.states.includes(c.location_state))) return false
      if (filters.cities.length > 0 && (!c.location_city || !filters.cities.includes(c.location_city))) return false
      if (filters.companies.length > 0 && (!c.company_current || !filters.companies.includes(c.company_current))) return false
      if (filters.seniorityLevels.length > 0 && (!c.seniority_level || !filters.seniorityLevels.includes(c.seniority_level))) return false
      if (filters.functionalAreas.length > 0 && (!c.functional_area || !filters.functionalAreas.includes(c.functional_area))) return false
      if (filters.specializations.length > 0 && (!c.specialization || !filters.specializations.includes(c.specialization))) return false
      if (filters.enrichmentStatuses.length > 0 && (!c.enrichment_status || !filters.enrichmentStatuses.includes(c.enrichment_status))) return false

      // Pipeline status filter — candidate must have at least one association matching
      if (filters.pipelineStatuses.length > 0) {
        const assocs = associationsMap?.get(c.id)
        if (!assocs || !assocs.some(a => a.pipelineStatus && filters.pipelineStatuses.includes(a.pipelineStatus))) return false
      }

      // Job filter — candidate must have at least one association with selected job
      if (filters.jobs.length > 0) {
        const assocs = associationsMap?.get(c.id)
        if (!assocs || !assocs.some(a => filters.jobs.includes(a.jobId))) return false
      }

      // Stage filter — candidate must have at least one association at selected stage
      if (filters.stages.length > 0) {
        const assocs = associationsMap?.get(c.id)
        if (!assocs || !assocs.some(a => a.stageName && filters.stages.includes(a.stageName))) return false
      }

      // Rejected at stage filter
      if (filters.rejectedAtStages.length > 0) {
        const assocs = associationsMap?.get(c.id)
        if (!assocs || !assocs.some(a => a.pipelineStatus === 'rejected' && a.stageName && filters.rejectedAtStages.includes(a.stageName))) return false
      }

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

      // Date filters: any date of that kind inside the range.
      for (const r of filters.dateRanges ?? []) {
        const dates = datesFor(r.field, c, associationsMap?.get(c.id), interviewsMap?.get(c.id))
        if (!inRange(dates, r, now)) return false
      }

      return true
    })
  }, [candidates, filters, searchTerm, associationsMap, candidateTagsMap, searchTexts, interviewsMap])
}

import { useMemo } from 'react'
import type { CandidateRow } from './useTalentInsightsData'

export interface FilterOption {
  value: string
  label: string
  count: number
}

function deriveOptions(candidates: CandidateRow[], keyFn: (c: CandidateRow) => string | null): FilterOption[] {
  const map = new Map<string, number>()
  for (const c of candidates) {
    const val = keyFn(c)?.trim()
    if (val) map.set(val, (map.get(val) || 0) + 1)
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, label: value, count }))
}

function deriveSkillOptions(candidates: CandidateRow[]): FilterOption[] {
  const map = new Map<string, number>()
  for (const c of candidates) {
    const skills = c.standardized_skills?.length ? c.standardized_skills : c.skills
    if (skills) {
      for (const s of skills) {
        const normalized = s.trim()
        if (normalized) map.set(normalized, (map.get(normalized) || 0) + 1)
      }
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([value, count]) => ({ value, label: value, count }))
}

export function useTalentInsightsFilterOptions(candidates: CandidateRow[]) {
  return useMemo(() => {
    if (!candidates || candidates.length === 0) {
      return {
        roleOptions: [],
        functionalAreaOptions: [],
        specializationOptions: [],
        seniorityOptions: [],
        skillOptions: [],
        countryOptions: [],
        stateOptions: [],
        cityOptions: [],
        experienceRange: null as { min: number; max: number } | null,
        salaryRange: null as { min: number; max: number } | null,
      }
    }

    const expValues = candidates.map(c => c.years_experience).filter((v): v is number => v != null)
    const salValues = candidates
      .filter(c => c.salary_amount != null && c.salary_amount > 0)
      .map(c => {
        const amount = c.salary_amount!
        switch (c.salary_period?.toLowerCase()) {
          case 'hourly': return amount * 2080
          case 'monthly': return amount * 12
          case 'weekly': return amount * 52
          case 'daily': return amount * 260
          default: return amount
        }
      })

    return {
      roleOptions: deriveOptions(candidates, c => c.standardized_title),
      functionalAreaOptions: deriveOptions(candidates, c => c.functional_area),
      specializationOptions: deriveOptions(candidates, c => c.specialization),
      seniorityOptions: deriveOptions(candidates, c => c.seniority_level),
      skillOptions: deriveSkillOptions(candidates),
      countryOptions: deriveOptions(candidates, c => c.location_country),
      stateOptions: deriveOptions(candidates, c => c.location_state),
      cityOptions: deriveOptions(candidates, c => c.location_city),
      experienceRange: expValues.length > 0
        ? { min: Math.min(...expValues), max: Math.max(...expValues) }
        : null,
      salaryRange: salValues.length > 0
        ? { min: Math.round(Math.min(...salValues)), max: Math.round(Math.max(...salValues)) }
        : null,
    }
  }, [candidates])
}

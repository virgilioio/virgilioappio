import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import type { TalentIntelligenceFilters } from '@/contexts/TalentIntelligenceFilterContext'

export interface CandidateRow {
  location_country: string | null
  location_city: string | null
  location_state: string | null
  years_experience: number | null
  seniority_level: string | null
  standardized_skills: string[] | null
  skills: string[] | null
  salary_amount: number | null
  salary_currency: string | null
  salary_period: string | null
  functional_area: string | null
  specialization: string | null
  standardized_title: string | null
  enriched_at: string | null
  created_at: string
}

export interface CountEntry { name: string; count: number }
export interface SkillEntry { name: string; count: number; percentage: number }
export interface SalaryStats { p25: number; median: number; p75: number; avg: number; count: number }
export interface ExperienceBand { band: string; count: number }

export interface TalentIntelligenceData {
  totalCandidates: number
  avgExperience: number | null
  medianSalary: number | null
  mostCommonRole: string | null
  enrichedPercentage: number | null
  countryCounts: CountEntry[]
  cityCounts: CountEntry[]
  experienceBands: ExperienceBand[]
  seniorityCounts: CountEntry[]
  topSkills: SkillEntry[]
  salaryStats: SalaryStats | null
  salaryBands: CountEntry[]
  salaryValues: number[]
  functionalAreaCounts: CountEntry[]
  specializationCounts: CountEntry[]
  titleCounts: CountEntry[]
}

function medianFn(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function percentile(arr: number[], p: number): number {
  const sorted = [...arr].sort((a, b) => a - b)
  const idx = (p / 100) * (sorted.length - 1)
  const lower = Math.floor(idx)
  const upper = Math.ceil(idx)
  if (lower === upper) return sorted[lower]
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower)
}

const COUNTRY_NORMALIZE: Record<string, string> = {
  'México': 'Mexico', 'MX': 'Mexico', 'EEUU': 'United States',
  'Estados Unidos': 'United States', 'US': 'United States', 'USA': 'United States',
  'Brasil': 'Brazil', 'Perú': 'Peru', 'UK': 'United Kingdom', 'GB': 'United Kingdom',
  'España': 'Spain', 'DE': 'Germany', 'FR': 'France', 'ES': 'Spain',
  'IN': 'India', 'AU': 'Australia', 'SG': 'Singapore', 'JP': 'Japan',
}

function normalizeValue(val: string | null, normalizeMap?: Record<string, string>): string | null {
  if (!val) return null
  const trimmed = val.trim()
  if (!trimmed) return null
  return normalizeMap?.[trimmed] ?? trimmed
}

function countBy<T>(items: T[], keyFn: (item: T) => string | null, normalizeMap?: Record<string, string>): CountEntry[] {
  const map = new Map<string, number>()
  for (const item of items) {
    const raw = keyFn(item)
    const key = normalizeValue(raw, normalizeMap)
    if (key) map.set(key, (map.get(key) || 0) + 1)
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

export function normalizeSalaryToAnnual(amount: number, period: string | null): number {
  switch (period?.toLowerCase()) {
    case 'hourly': return amount * 2080
    case 'monthly': return amount * 12
    case 'weekly': return amount * 52
    case 'daily': return amount * 260
    default: return amount
  }
}

// --- Apply filters to candidate array ---
export function applyFilters(candidates: CandidateRow[], filters: TalentIntelligenceFilters): CandidateRow[] {
  return candidates.filter(c => {
    if (filters.roles.length > 0 && !filters.roles.includes(c.standardized_title ?? '')) return false
    if (filters.functionalAreas.length > 0 && !filters.functionalAreas.includes(c.functional_area ?? '')) return false
    if (filters.specializations.length > 0 && !filters.specializations.includes(c.specialization ?? '')) return false
    if (filters.seniorities.length > 0 && !filters.seniorities.includes(c.seniority_level ?? '')) return false
    if (filters.skills.length > 0) {
      const candidateSkills = c.standardized_skills?.length ? c.standardized_skills : c.skills
      if (!candidateSkills || !filters.skills.some(s => candidateSkills.includes(s))) return false
    }
    if (filters.countries.length > 0) {
      const normalized = normalizeValue(c.location_country, COUNTRY_NORMALIZE)
      if (!normalized || !filters.countries.includes(normalized)) return false
    }
    if (filters.states.length > 0 && !filters.states.includes(c.location_state ?? '')) return false
    if (filters.cities.length > 0 && !filters.cities.includes(c.location_city ?? '')) return false
    if (filters.experienceMin !== null && (c.years_experience == null || c.years_experience < filters.experienceMin)) return false
    if (filters.experienceMax !== null && (c.years_experience == null || c.years_experience > filters.experienceMax)) return false
    if (filters.salaryMin !== null || filters.salaryMax !== null) {
      if (c.salary_amount == null || c.salary_amount <= 0) return false
      const annual = normalizeSalaryToAnnual(c.salary_amount, c.salary_period)
      if (filters.salaryMin !== null && annual < filters.salaryMin) return false
      if (filters.salaryMax !== null && annual > filters.salaryMax) return false
    }
    if (filters.dateFrom) {
      const created = new Date(c.created_at)
      if (created < filters.dateFrom) return false
    }
    if (filters.dateTo) {
      const created = new Date(c.created_at)
      if (created > filters.dateTo) return false
    }
    return true
  })
}

// --- Compute aggregations from a candidate array ---
function computeInsights(candidates: CandidateRow[]): TalentIntelligenceData {
  const total = candidates.length

  if (total === 0) {
    return {
      totalCandidates: 0, avgExperience: null, medianSalary: null,
      mostCommonRole: null, enrichedPercentage: null,
      countryCounts: [], cityCounts: [], experienceBands: [],
      seniorityCounts: [], topSkills: [], salaryStats: null,
      salaryBands: [], salaryValues: [],
      functionalAreaCounts: [], specializationCounts: [], titleCounts: [],
    }
  }

  const expValues = candidates.map(c => c.years_experience).filter((v): v is number => v != null)
  const avgExperience = expValues.length > 0 ? Math.round((expValues.reduce((a, b) => a + b, 0) / expValues.length) * 10) / 10 : null

  const bandDef = [
    { band: '0–2 years', min: 0, max: 2 },
    { band: '3–5 years', min: 3, max: 5 },
    { band: '6–10 years', min: 6, max: 10 },
    { band: '10+ years', min: 11, max: Infinity },
  ]
  const experienceBands: ExperienceBand[] = bandDef.map(({ band, min, max }) => ({
    band, count: expValues.filter(v => v >= min && v <= max).length,
  }))

  const salaryValues = candidates
    .filter(c => c.salary_amount != null && c.salary_amount > 0)
    .map(c => normalizeSalaryToAnnual(c.salary_amount!, c.salary_period))

  const salaryStats: SalaryStats | null = salaryValues.length >= 3
    ? {
        p25: Math.round(percentile(salaryValues, 25)),
        median: Math.round(medianFn(salaryValues)),
        p75: Math.round(percentile(salaryValues, 75)),
        avg: Math.round(salaryValues.reduce((a, b) => a + b, 0) / salaryValues.length),
        count: salaryValues.length,
      }
    : null

  const salaryBandDefs = [
    { name: '< $30k', min: 0, max: 30000 },
    { name: '$30k–$50k', min: 30000, max: 50000 },
    { name: '$50k–$75k', min: 50000, max: 75000 },
    { name: '$75k–$100k', min: 75000, max: 100000 },
    { name: '$100k–$150k', min: 100000, max: 150000 },
    { name: '$150k+', min: 150000, max: Infinity },
  ]
  const salaryBands = salaryBandDefs.map(({ name, min, max }) => ({
    name, count: salaryValues.filter(v => v >= min && v < max).length,
  }))

  const skillMap = new Map<string, number>()
  for (const c of candidates) {
    const skills = c.standardized_skills?.length ? c.standardized_skills : c.skills
    if (skills) {
      for (const s of skills) {
        const normalized = s.trim()
        if (normalized) skillMap.set(normalized, (skillMap.get(normalized) || 0) + 1)
      }
    }
  }
  const topSkills: SkillEntry[] = Array.from(skillMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([name, count]) => ({ name, count, percentage: Math.round((count / total) * 100) }))

  const countryCounts = countBy(candidates, c => c.location_country, COUNTRY_NORMALIZE).slice(0, 10)
  const cityCounts = countBy(candidates, c => c.location_city).slice(0, 10)

  const titleCounts = countBy(candidates, c => c.standardized_title || c.functional_area).slice(0, 10)
  const mostCommonRole = titleCounts.length > 0 ? titleCounts[0].name : null

  const seniorityCounts = countBy(candidates, c => c.seniority_level)
  const functionalAreaCounts = countBy(candidates, c => c.functional_area)
  const specializationCounts = countBy(candidates, c => c.specialization).slice(0, 10)

  const enrichedCount = candidates.filter(c => c.enriched_at != null).length
  const enrichedPercentage = Math.round((enrichedCount / total) * 100)

  return {
    totalCandidates: total, avgExperience, medianSalary: salaryStats?.median ?? null,
    mostCommonRole, enrichedPercentage, countryCounts, cityCounts,
    experienceBands, seniorityCounts, topSkills, salaryStats, salaryBands,
    salaryValues, functionalAreaCounts, specializationCounts, titleCounts,
  }
}

// --- Raw data hook (fetches once, caches) ---
export function useTalentIntelligenceRawData() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['talent-intelligence-raw', user?.id],
    queryFn: async (): Promise<CandidateRow[]> => {
      if (!user) throw new Error('No user')

      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('user_status', 'active')
        .single()

      if (memberError || !memberData?.tenant_id) {
        throw new Error('Unable to determine tenant context')
      }

      let allCandidates: CandidateRow[] = []
      let from = 0
      const pageSize = 1000

      while (true) {
        const { data, error } = await supabase
          .from('candidates')
          .select('location_country, location_city, location_state, years_experience, seniority_level, standardized_skills, skills, salary_amount, salary_currency, salary_period, functional_area, specialization, standardized_title, enriched_at, created_at')
          .eq('tenant_id', memberData.tenant_id)
          .is('deleted_at', null)
          .range(from, from + pageSize - 1)

        if (error) throw error
        if (!data || data.length === 0) break
        allCandidates = allCandidates.concat(data as CandidateRow[])
        if (data.length < pageSize) break
        from += pageSize
      }

      return allCandidates
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })
}

// --- Filtered + aggregated data hook ---
export function useTalentIntelligenceData(filters?: TalentIntelligenceFilters) {
  const { data: rawCandidates, isLoading, error } = useTalentIntelligenceRawData()

  const data = useMemo(() => {
    if (!rawCandidates) return null
    const filtered = filters ? applyFilters(rawCandidates, filters) : rawCandidates
    return computeInsights(filtered)
  }, [rawCandidates, filters])

  return {
    data,
    rawCandidates: rawCandidates ?? [],
    isLoading,
    error,
  }
}

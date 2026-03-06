import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

interface CandidateRow {
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

export interface TalentInsightsData {
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
  functionalAreaCounts: CountEntry[]
  specializationCounts: CountEntry[]
  titleCounts: CountEntry[]
}

function median(arr: number[]): number {
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

function countBy<T>(items: T[], keyFn: (item: T) => string | null): CountEntry[] {
  const map = new Map<string, number>()
  for (const item of items) {
    const key = keyFn(item)
    if (key) map.set(key, (map.get(key) || 0) + 1)
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}

function normalizeSalaryToAnnual(amount: number, period: string | null): number {
  switch (period?.toLowerCase()) {
    case 'hourly': return amount * 2080
    case 'monthly': return amount * 12
    case 'weekly': return amount * 52
    case 'daily': return amount * 260
    default: return amount // assume annual
  }
}

export function useTalentInsightsData() {
  const { user } = useAuth()

  return useQuery({
    queryKey: ['talent-insights', user?.id],
    queryFn: async (): Promise<TalentInsightsData> => {
      if (!user) throw new Error('No user')

      // Tenant isolation
      const { data: memberData, error: memberError } = await supabase
        .from('members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('user_status', 'active')
        .single()

      if (memberError || !memberData?.tenant_id) {
        throw new Error('Unable to determine tenant context')
      }

      const tenantId = memberData.tenant_id

      // Fetch all candidates (paginate past 1000 limit)
      let allCandidates: CandidateRow[] = []
      let from = 0
      const pageSize = 1000
      
      while (true) {
        const { data, error } = await supabase
          .from('candidates')
          .select('location_country, location_city, location_state, years_experience, seniority_level, standardized_skills, skills, salary_amount, salary_currency, salary_period, functional_area, specialization, standardized_title, enriched_at, created_at')
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .range(from, from + pageSize - 1)

        if (error) throw error
        if (!data || data.length === 0) break
        allCandidates = allCandidates.concat(data as CandidateRow[])
        if (data.length < pageSize) break
        from += pageSize
      }

      const candidates = allCandidates
      const total = candidates.length

      if (total === 0) {
        return {
          totalCandidates: 0,
          avgExperience: null,
          medianSalary: null,
          mostCommonRole: null,
          enrichedPercentage: null,
          countryCounts: [],
          cityCounts: [],
          experienceBands: [],
          seniorityCounts: [],
          topSkills: [],
          salaryStats: null,
          salaryBands: [],
          functionalAreaCounts: [],
          specializationCounts: [],
          titleCounts: [],
        }
      }

      // Experience
      const expValues = candidates.map(c => c.years_experience).filter((v): v is number => v != null)
      const avgExperience = expValues.length > 0 ? Math.round((expValues.reduce((a, b) => a + b, 0) / expValues.length) * 10) / 10 : null

      const bandDef = [
        { band: '0–2 years', min: 0, max: 2 },
        { band: '3–5 years', min: 3, max: 5 },
        { band: '6–10 years', min: 6, max: 10 },
        { band: '10+ years', min: 11, max: Infinity },
      ]
      const experienceBands: ExperienceBand[] = bandDef.map(({ band, min, max }) => ({
        band,
        count: expValues.filter(v => v >= min && v <= max).length,
      }))

      // Salary
      const salaryValues = candidates
        .filter(c => c.salary_amount != null && c.salary_amount > 0)
        .map(c => normalizeSalaryToAnnual(c.salary_amount!, c.salary_period))

      const salaryStats: SalaryStats | null = salaryValues.length >= 3
        ? {
            p25: Math.round(percentile(salaryValues, 25)),
            median: Math.round(median(salaryValues)),
            p75: Math.round(percentile(salaryValues, 75)),
            avg: Math.round(salaryValues.reduce((a, b) => a + b, 0) / salaryValues.length),
            count: salaryValues.length,
          }
        : null

      const medianSalary = salaryStats?.median ?? null

      // Salary bands
      const salaryBandDefs = [
        { name: '< $30k', min: 0, max: 30000 },
        { name: '$30k–$50k', min: 30000, max: 50000 },
        { name: '$50k–$75k', min: 50000, max: 75000 },
        { name: '$75k–$100k', min: 75000, max: 100000 },
        { name: '$100k–$150k', min: 100000, max: 150000 },
        { name: '$150k+', min: 150000, max: Infinity },
      ]
      const salaryBands = salaryBandDefs.map(({ name, min, max }) => ({
        name,
        count: salaryValues.filter(v => v >= min && v < max).length,
      }))

      // Skills
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
        .map(([name, count]) => ({
          name,
          count,
          percentage: Math.round((count / total) * 100),
        }))

      // Geography
      const countryCounts = countBy(candidates, c => c.location_country).slice(0, 10)
      const cityCounts = countBy(candidates, c => c.location_city).slice(0, 10)

      // Role / composition
      const titleCounts = countBy(candidates, c => c.standardized_title || c.functional_area).slice(0, 10)
      const mostCommonRole = titleCounts.length > 0 ? titleCounts[0].name : null

      const seniorityCounts = countBy(candidates, c => c.seniority_level)
      const functionalAreaCounts = countBy(candidates, c => c.functional_area)
      const specializationCounts = countBy(candidates, c => c.specialization).slice(0, 10)

      // Enriched %
      const enrichedCount = candidates.filter(c => c.enriched_at != null).length
      const enrichedPercentage = Math.round((enrichedCount / total) * 100)

      return {
        totalCandidates: total,
        avgExperience,
        medianSalary,
        mostCommonRole,
        enrichedPercentage,
        countryCounts,
        cityCounts,
        experienceBands,
        seniorityCounts,
        topSkills,
        salaryStats,
        salaryBands,
        functionalAreaCounts,
        specializationCounts,
        titleCounts,
      }
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })
}

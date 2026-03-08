import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export interface DistributionItem {
  name: string
  count: number
}

export interface TalentInsightsData {
  seniorityDistribution: DistributionItem[]
  topSkills: DistributionItem[]
  geographyDistribution: DistributionItem[]
  experienceDistribution: DistributionItem[]
  isLoading: boolean
  error: Error | null
}

export function useTalentInsightsMetrics(
  finalJobIds: string[],
  enabled: boolean
): TalentInsightsData {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-talent-insights', finalJobIds.join(',')],
    queryFn: async () => {
      if (finalJobIds.length === 0) return {
        seniorityDistribution: [],
        topSkills: [],
        geographyDistribution: [],
        experienceDistribution: [],
      }

      // Get candidate IDs from associations
      const { data: assocs, error: aErr } = await supabase
        .from('job_candidate_associations')
        .select('candidate_id')
        .in('job_id', finalJobIds)
      if (aErr) throw aErr

      const candidateIds = [...new Set((assocs || []).map(a => a.candidate_id))]
      if (candidateIds.length === 0) return {
        seniorityDistribution: [],
        topSkills: [],
        geographyDistribution: [],
        experienceDistribution: [],
      }

      // Fetch candidate profile fields in batches
      const allCandidates: any[] = []
      for (let i = 0; i < candidateIds.length; i += 500) {
        const batch = candidateIds.slice(i, i + 500)
        const { data: cands } = await supabase
          .from('candidates')
          .select('id, seniority_level, standardized_skills, location_country, years_experience')
          .in('id', batch)
        if (cands) allCandidates.push(...cands)
      }

      // Seniority
      const seniorityMap: Record<string, number> = {}
      allCandidates.forEach(c => {
        const level = c.seniority_level || 'Not specified'
        seniorityMap[level] = (seniorityMap[level] || 0) + 1
      })
      const seniorityDistribution = Object.entries(seniorityMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)

      // Skills (top 15)
      const skillsMap: Record<string, number> = {}
      allCandidates.forEach(c => {
        const skills: string[] = c.standardized_skills || []
        skills.forEach(s => {
          skillsMap[s] = (skillsMap[s] || 0) + 1
        })
      })
      const topSkills = Object.entries(skillsMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15)

      // Geography
      const geoMap: Record<string, number> = {}
      allCandidates.forEach(c => {
        const country = c.location_country || 'Not specified'
        geoMap[country] = (geoMap[country] || 0) + 1
      })
      const geographyDistribution = Object.entries(geoMap)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15)

      // Experience buckets
      const expBuckets: Record<string, number> = {
        '0-2 years': 0,
        '3-5 years': 0,
        '6-10 years': 0,
        '10+ years': 0,
        'Not specified': 0,
      }
      allCandidates.forEach(c => {
        const ye = c.years_experience
        if (ye === null || ye === undefined) {
          expBuckets['Not specified']++
        } else if (ye <= 2) {
          expBuckets['0-2 years']++
        } else if (ye <= 5) {
          expBuckets['3-5 years']++
        } else if (ye <= 10) {
          expBuckets['6-10 years']++
        } else {
          expBuckets['10+ years']++
        }
      })
      const experienceDistribution = Object.entries(expBuckets)
        .map(([name, count]) => ({ name, count }))
        .filter(e => e.count > 0)

      return { seniorityDistribution, topSkills, geographyDistribution, experienceDistribution }
    },
    enabled: enabled && finalJobIds.length > 0,
    staleTime: 1000 * 60 * 5,
  })

  return {
    seniorityDistribution: data?.seniorityDistribution ?? [],
    topSkills: data?.topSkills ?? [],
    geographyDistribution: data?.geographyDistribution ?? [],
    experienceDistribution: data?.experienceDistribution ?? [],
    isLoading,
    error: error as Error | null,
  }
}

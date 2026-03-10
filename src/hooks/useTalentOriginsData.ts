import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

export type OriginSegment = 'all' | 'current' | 'previous'

export interface CompanyOriginEntry {
  companyName: string
  count: number
  logoUrl: string | null
  industry: string | null
  currentCount: number
  previousCount: number
}

interface WorkExpRow {
  candidate_id: string
  company_name: string
  company_logo_url: string | null
  company_industry: string | null
  is_current: boolean | null
}

const SUFFIX_REGEX = /[,.]?\s*\b(inc|llc|ltd|corp|corporation|co|company|s\.?a\.?|s\.?a\.?\s*de\s*c\.?v\.?|gmbh|plc|pty|limited|incorporated|group|holdings)\b\.?$/i

function normalizeCompanyName(name: string): string {
  let cleaned = name.trim()
  // Strip suffixes iteratively (handles "Google, Inc." and "Google LLC")
  let prev = ''
  while (prev !== cleaned) {
    prev = cleaned
    cleaned = cleaned.replace(SUFFIX_REGEX, '').trim()
  }
  // Remove trailing punctuation
  cleaned = cleaned.replace(/[,.\-]+$/, '').trim()
  if (!cleaned) return name.trim()
  // Title case
  return cleaned
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export function useTalentOriginsData(filteredCandidateIds: string[]) {
  const { user } = useAuth()
  const [segment, setSegment] = useState<OriginSegment>('all')

  const { data: rawExperience, isLoading } = useQuery({
    queryKey: ['talent-origins-raw', user?.id],
    queryFn: async (): Promise<WorkExpRow[]> => {
      if (!user) throw new Error('No user')

      const { data: memberData } = await supabase
        .from('members')
        .select('tenant_id')
        .eq('user_id', user.id)
        .eq('user_status', 'active')
        .single()

      if (!memberData?.tenant_id) throw new Error('No tenant')

      // Fetch work experience joined through candidates for tenant scoping
      let allRows: WorkExpRow[] = []
      let from = 0
      const pageSize = 1000

      while (true) {
        const { data, error } = await supabase
          .from('candidate_work_experience')
          .select('candidate_id, company_name, company_logo_url, company_industry, is_current, candidates!inner(tenant_id)')
          .eq('candidates.tenant_id', memberData.tenant_id)
          .range(from, from + pageSize - 1)

        if (error) throw error
        if (!data || data.length === 0) break
        allRows = allRows.concat(
          data.map((d: any) => ({
            candidate_id: d.candidate_id,
            company_name: d.company_name,
            company_logo_url: d.company_logo_url,
            company_industry: d.company_industry,
            is_current: d.is_current,
          }))
        )
        if (data.length < pageSize) break
        from += pageSize
      }

      return allRows
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  })

  const companies = useMemo(() => {
    if (!rawExperience) return []

    const candidateIdSet = new Set(filteredCandidateIds)
    
    // Filter by active candidates from the page filters
    let filtered = rawExperience.filter(exp => candidateIdSet.size === 0 || candidateIdSet.has(exp.candidate_id))

    // Aggregate by normalized company name
    const companyMap = new Map<string, {
      count: number
      logoUrl: string | null
      industry: string | null
      currentCount: number
      previousCount: number
      candidateIds: Set<string>
    }>()

    for (const exp of filtered) {
      if (!exp.company_name?.trim()) continue

      const segmentMatch = segment === 'all' ||
        (segment === 'current' && exp.is_current) ||
        (segment === 'previous' && !exp.is_current)
      if (!segmentMatch) continue

      const normalized = normalizeCompanyName(exp.company_name)
      const existing = companyMap.get(normalized)

      if (existing) {
        existing.candidateIds.add(exp.candidate_id)
        if (exp.is_current) existing.currentCount++
        else existing.previousCount++
        // Prefer non-null logo/industry
        if (!existing.logoUrl && exp.company_logo_url) existing.logoUrl = exp.company_logo_url
        if (!existing.industry && exp.company_industry) existing.industry = exp.company_industry
      } else {
        companyMap.set(normalized, {
          count: 0,
          logoUrl: exp.company_logo_url,
          industry: exp.company_industry,
          currentCount: exp.is_current ? 1 : 0,
          previousCount: exp.is_current ? 0 : 1,
          candidateIds: new Set([exp.candidate_id]),
        })
      }
    }

    const result: CompanyOriginEntry[] = Array.from(companyMap.entries())
      .map(([companyName, v]) => ({
        companyName,
        count: v.candidateIds.size, // unique candidates, not experience count
        logoUrl: v.logoUrl,
        industry: v.industry,
        currentCount: v.currentCount,
        previousCount: v.previousCount,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15)

    return result
  }, [rawExperience, filteredCandidateIds, segment])

  return { companies, isLoading, segment, setSegment }
}

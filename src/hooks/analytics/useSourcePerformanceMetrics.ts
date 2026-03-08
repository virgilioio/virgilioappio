import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export interface SourceRow {
  source: string
  total: number
  active: number
  hires: number
  offers: number
  conversionRate: number // hires / total
}

export interface SourcePerformanceData {
  rows: SourceRow[]
  isLoading: boolean
  error: Error | null
}

export function useSourcePerformanceMetrics(
  finalJobIds: string[],
  enabled: boolean
): SourcePerformanceData {
  const { data, isLoading, error } = useQuery({
    queryKey: ['analytics-source-perf', finalJobIds.join(',')],
    queryFn: async () => {
      if (finalJobIds.length === 0) return { rows: [] }

      // Get associations with candidate_id
      const { data: assocs, error: aErr } = await supabase
        .from('job_candidate_associations')
        .select('id, candidate_id, status')
        .in('job_id', finalJobIds)
      if (aErr) throw aErr

      if (!assocs || assocs.length === 0) return { rows: [] }

      const candidateIds = [...new Set(assocs.map(a => a.candidate_id))]

      // Get candidate sources (batch in groups of 500 to stay under 1000 limit)
      const allCandidates: { id: string; source: string | null }[] = []
      for (let i = 0; i < candidateIds.length; i += 500) {
        const batch = candidateIds.slice(i, i + 500)
        const { data: cands } = await supabase
          .from('candidates')
          .select('id, source')
          .in('id', batch)
        if (cands) allCandidates.push(...cands)
      }

      const candidateSourceMap = new Map(allCandidates.map(c => [c.id, c.source || 'Unknown']))

      // Aggregate by source
      const sourceMap = new Map<string, { total: number; active: number; hires: number; offers: number }>()

      assocs.forEach(a => {
        let source = candidateSourceMap.get(a.candidate_id) || 'Unknown'
        // Normalize common sources
        source = normalizeSource(source)
        if (!sourceMap.has(source)) {
          sourceMap.set(source, { total: 0, active: 0, hires: 0, offers: 0 })
        }
        const s = sourceMap.get(source)!
        s.total++
        if (a.status === 'active') s.active++
        if (a.status === 'hired') s.hires++
        if (a.status === 'offer') s.offers++
      })

      const rows: SourceRow[] = Array.from(sourceMap.entries())
        .map(([source, counts]) => ({
          source,
          ...counts,
          conversionRate: counts.total > 0 ? Math.round((counts.hires / counts.total) * 1000) / 10 : 0,
        }))
        .sort((a, b) => b.total - a.total)

      return { rows }
    },
    enabled: enabled && finalJobIds.length > 0,
    staleTime: 1000 * 60 * 5,
  })

  return {
    rows: data?.rows ?? [],
    isLoading,
    error: error as Error | null,
  }
}

function normalizeSource(source: string): string {
  const lower = source.toLowerCase().trim()
  if (lower === 'applied' || lower === 'application' || lower === 'career_page' || lower === 'careers_page') return 'Applied'
  if (lower.includes('linkedin')) return 'LinkedIn'
  if (lower.includes('referral') || lower === 'referred') return 'Referral'
  if (lower.includes('sourced') || lower === 'sourcing') return 'Sourced'
  if (lower.includes('indeed')) return 'Indeed'
  if (lower === 'manual' || lower === 'manual_add') return 'Manual Add'
  if (lower === 'unknown' || lower === '' || lower === 'null') return 'Unknown'
  return source.charAt(0).toUpperCase() + source.slice(1)
}

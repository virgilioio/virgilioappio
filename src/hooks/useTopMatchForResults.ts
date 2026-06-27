import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'

interface MinCandidate {
  id: string
  candidate_id?: string | null
  display_source?: 'internal' | 'gio' | 'apollo' | 'pdl'
  source?: 'local' | 'apollo' | 'pdl'
  full_name?: string
  candidate_name?: string
}

export interface TopMatchResult {
  rowId: string // matches MinCandidate.id (row id in the results list)
  candidateId: string
  name: string
  score: number
}

/**
 * Resolves a real "Top match" using AI fit data.
 *
 * Rules — all must hold, otherwise returns null:
 *  - Project linked to a job (jobId required)
 *  - Candidate is internal/collected (has candidate_id resolved)
 *  - job_candidate_associations.ai_fit_score >= 80
 *  - ai_fit_confidence != 'low'
 *  - Strictly highest ai_fit_score (no ties at the top)
 */
export function useTopMatchForResults(
  jobId: string | null | undefined,
  candidates: MinCandidate[]
): { topMatch: TopMatchResult | null; isLoading: boolean } {
  // Collect internal candidate ids and remember which row they came from
  const internalRows = candidates
    .map((c) => {
      const isInternal =
        c.display_source === 'internal' ||
        (c.source === 'apollo' && !!c.candidate_id) ||
        !!c.candidate_id
      const cid = c.candidate_id || (c.display_source === 'internal' ? c.id : null)
      if (!isInternal || !cid) return null
      return {
        rowId: c.id,
        candidateId: cid,
        name: c.full_name || c.candidate_name || '',
      }
    })
    .filter((x): x is { rowId: string; candidateId: string; name: string } => !!x)

  const candidateIds = internalRows.map((r) => r.candidateId)
  const cacheKey = candidateIds.slice().sort().join(',')

  const { data, isLoading } = useQuery({
    queryKey: ['top-match-for-results', jobId, cacheKey],
    enabled: !!jobId && candidateIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_candidate_associations')
        .select('candidate_id, ai_fit_score, ai_fit_confidence')
        .eq('job_id', jobId!)
        .in('candidate_id', candidateIds)
        .not('ai_fit_score', 'is', null)

      if (error) throw error
      return data || []
    },
  })

  if (!jobId || !data || data.length === 0) {
    return { topMatch: null, isLoading }
  }

  // Filter to qualifying (>=80, not low confidence)
  const qualifying = data.filter(
    (r) => (r.ai_fit_score ?? 0) >= 80 && r.ai_fit_confidence !== 'low'
  )
  if (qualifying.length === 0) return { topMatch: null, isLoading }

  // Sort desc by score
  const sorted = [...qualifying].sort(
    (a, b) => (b.ai_fit_score ?? 0) - (a.ai_fit_score ?? 0)
  )
  const top = sorted[0]
  // Strict top — no ties
  if (sorted[1] && (sorted[1].ai_fit_score ?? 0) === (top.ai_fit_score ?? 0)) {
    return { topMatch: null, isLoading }
  }

  const row = internalRows.find((r) => r.candidateId === top.candidate_id)
  if (!row) return { topMatch: null, isLoading }

  return {
    topMatch: {
      rowId: row.rowId,
      candidateId: row.candidateId,
      name: row.name,
      score: top.ai_fit_score!,
    },
    isLoading,
  }
}

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

/** One stored Gio Fit assessment (fit_score_history, 2026-10-14). */
export interface FitScorePoint {
  id: string
  version: number
  score: number | null
  confidence: string | null
  trigger: 'refresh' | 'auto' | 'queue' | 'scorecard' | 'unknown'
  changesSinceLast: string | null
  generatedAt: string
}

export const TRIGGER_LABEL: Record<FitScorePoint['trigger'], string> = {
  refresh: 'Refreshed by a recruiter',
  auto: 'Re-checked on open',
  queue: 'Prepared for the client view',
  scorecard: 'After a scorecard',
  unknown: 'Assessed',
}

const asTrigger = (v: unknown): FitScorePoint['trigger'] =>
  v === 'refresh' || v === 'auto' || v === 'queue' || v === 'scorecard' ? v : 'unknown'

/** Every assessment of one application, oldest first. Empty before the first one. */
export function useFitScoreHistory(associationId: string | null) {
  return useQuery({
    queryKey: ['fit-score-history', associationId],
    enabled: !!associationId,
    staleTime: 60_000,
    queryFn: async (): Promise<FitScorePoint[]> => {
      if (!associationId) return []
      const { data, error } = await supabase
        .from('fit_score_history')
        .select('id, version, score, confidence, trigger, changes_since_last, generated_at')
        .eq('association_id', associationId)
        .order('generated_at', { ascending: true })
      if (error) throw error
      return (data || []).map((row) => ({
        id: row.id,
        version: row.version,
        score: row.score,
        confidence: row.confidence,
        trigger: asTrigger(row.trigger),
        changesSinceLast: row.changes_since_last,
        generatedAt: row.generated_at,
      }))
    },
  })
}

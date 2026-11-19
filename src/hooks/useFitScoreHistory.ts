import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import type { FitCause } from '@/hooks/useCandidateFitInsights'

/** One stored Gio Fit assessment (fit_score_history, 2026-10-14). */
export interface FitScorePoint {
  id: string
  version: number
  score: number | null
  confidence: string | null
  trigger: 'refresh' | 'auto' | 'queue' | 'scorecard' | 'unknown'
  /** v5: what the assessment was caused by. Older points only have `trigger`. */
  cause: FitCause | null
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

/** What moved the score, as the Gio Fit tab's history and the lists' marker word it. */
export const CAUSE_LABEL: Record<FitCause, string> = {
  first: 'First assessment',
  scorecard: 'After a scorecard',
  application: 'After the application answers',
  profile: 'After a profile or résumé change',
  job: 'After the job changed',
  recipe: 'Scoring update',
  refresh: 'Refreshed by a recruiter',
  recheck: 'Re-checked',
}

const CAUSES = new Set<string>(Object.keys(CAUSE_LABEL))
export const asCause = (v: unknown): FitCause | null => (typeof v === 'string' && CAUSES.has(v) ? (v as FitCause) : null)

/** A history point's line: its cause when it has one, else how it was started. */
export const pointLabel = (point: Pick<FitScorePoint, 'cause' | 'trigger'>) =>
  point.cause ? CAUSE_LABEL[point.cause] : TRIGGER_LABEL[point.trigger]

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
        .select('id, version, score, confidence, trigger, changes_since_last, generated_at, scoring')
        .eq('association_id', associationId)
        .order('generated_at', { ascending: true })
      if (error) throw error
      return (data || []).map((row) => ({
        id: row.id,
        version: row.version,
        score: row.score,
        confidence: row.confidence,
        trigger: asTrigger(row.trigger),
        cause: asCause((row.scoring as { cause?: unknown } | null)?.cause),
        changesSinceLast: row.changes_since_last,
        generatedAt: row.generated_at,
      }))
    },
  })
}

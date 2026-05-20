import { Sparkles, ChevronRight } from 'lucide-react'

interface SourceBreakdown {
  internal?: number
  gio?: number
  pdl: number
  apollo: number
  full_data: number
  preview_only: number
}

interface ResultsRunSummaryProps {
  totalCount: number
  strongFit: number
  good: number
  possible: number
  alreadyCollected: number
  topMatchName?: string | null
  topMatchScore?: number | null
  sourceBreakdown?: SourceBreakdown
  onExplain?: () => void
}

/**
 * Lilac AI summary banner shown above the candidate results.
 * Single tight row: counts on top, sources + top match below, "Why these results?" on the far right.
 */
export function ResultsRunSummary({
  totalCount,
  strongFit,
  good,
  possible,
  alreadyCollected,
  topMatchName,
  topMatchScore,
  sourceBreakdown,
  onExplain,
}: ResultsRunSummaryProps) {
  const sourceParts: string[] = []
  if (sourceBreakdown) {
    const linkedin = (sourceBreakdown.pdl || 0) + (sourceBreakdown.gio || 0)
    if (linkedin > 0) sourceParts.push(`LinkedIn (${linkedin})`)
    if (sourceBreakdown.apollo > 0) sourceParts.push(`Apollo (${sourceBreakdown.apollo})`)
    if (sourceBreakdown.internal && sourceBreakdown.internal > 0) {
      sourceParts.push(`Internal (${sourceBreakdown.internal})`)
    }
  }

  return (
    <div className="rounded-lg border border-virgilio-purple/25 bg-white px-3.5 py-2.5">
      <div className="flex items-center gap-3">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-virgilio-purple/15 text-virgilio-purple">
          <Sparkles className="h-3.5 w-3.5" />
        </div>

        <div className="flex-1 min-w-0">
          {/* Primary line */}
          <div className="flex flex-wrap items-center gap-x-1.5 font-inter text-[13px] leading-tight">
            <span className="font-medium text-text-primary">
              {totalCount} preview candidates
            </span>
            <span className="text-text-tertiary/60" aria-hidden>·</span>
            <span className="text-text-secondary">
              <span className="font-semibold text-emerald-700 tabular-nums">{strongFit}</span> strong fit
            </span>
            <span className="text-text-tertiary/60" aria-hidden>·</span>
            <span className="text-text-secondary">
              <span className="font-semibold text-blue-700 tabular-nums">{good}</span> good
            </span>
            <span className="text-text-tertiary/60" aria-hidden>·</span>
            <span className="text-text-secondary">
              <span className="font-semibold text-amber-700 tabular-nums">{possible}</span> possible
            </span>
            {alreadyCollected > 0 && (
              <>
                <span className="text-text-tertiary/60" aria-hidden>·</span>
                <span className="text-virgilio-purple font-medium">
                  <span className="tabular-nums">{alreadyCollected}</span> already collected
                </span>
              </>
            )}
          </div>

          {/* Secondary line */}
          {(sourceParts.length > 0 || topMatchName) && (
            <div className="mt-0.5 font-inter text-[11.5px] text-text-tertiary leading-tight truncate">
              {sourceParts.length > 0 && <>Sourced from {sourceParts.join(', ')}.</>}
              {sourceParts.length > 0 && topMatchName && ' '}
              {topMatchName && (
                <>
                  Top match:{' '}
                  <span className="font-medium text-text-secondary">{topMatchName}</span>
                  {topMatchScore != null && <> · {topMatchScore} fit.</>}
                </>
              )}
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={onExplain}
          className="shrink-0 inline-flex items-center gap-0.5 font-poppins text-[12px] font-medium text-virgilio-purple hover:bg-virgilio-purple/10 rounded-md px-2 h-7 transition-colors"
        >
          Why these results?
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}

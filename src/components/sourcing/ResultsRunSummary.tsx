import { Sparkles, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

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
 * Explains what the run found, where it came from, and the top match.
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
  // Build source list from breakdown
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
    <div className="rounded-lg border border-virgilio-purple/20 bg-gradient-to-r from-virgilio-purple/8 via-virgilio-purple/5 to-transparent px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-virgilio-purple/15 text-virgilio-purple">
          <Sparkles className="h-3.5 w-3.5" />
        </div>

        <div className="flex-1 min-w-0 space-y-1">
          {/* Primary line: counts */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-sm">
            <span className="font-medium text-text-primary">
              {totalCount} preview candidates
            </span>
            <Dot />
            <span className="text-text-secondary">
              <span className="font-medium text-emerald-700">{strongFit}</span> strong fit
            </span>
            <Dot />
            <span className="text-text-secondary">
              <span className="font-medium text-blue-700">{good}</span> good
            </span>
            <Dot />
            <span className="text-text-secondary">
              <span className="font-medium text-amber-700">{possible}</span> possible
            </span>
            {alreadyCollected > 0 && (
              <>
                <Dot />
                <span className="text-virgilio-purple">
                  {alreadyCollected} already collected
                </span>
              </>
            )}
          </div>

          {/* Secondary line: sources + top match */}
          {(sourceParts.length > 0 || topMatchName) && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-tertiary">
              {sourceParts.length > 0 && (
                <span>Sourced from {sourceParts.join(', ')}</span>
              )}
              {sourceParts.length > 0 && topMatchName && <Dot subtle />}
              {topMatchName && (
                <span>
                  Top match:{' '}
                  <span className="font-medium text-text-secondary">{topMatchName}</span>
                  {topMatchScore != null && (
                    <span className="text-text-tertiary"> · {topMatchScore} fit</span>
                  )}
                </span>
              )}
            </div>
          )}
        </div>

        {onExplain && (
          <Button
            size="sm"
            variant="ghost"
            iconRight={ChevronRight}
            onClick={onExplain}
            className="shrink-0 text-virgilio-purple hover:bg-virgilio-purple/10"
          >
            Why these results?
          </Button>
        )}
      </div>
    </div>
  )
}

function Dot({ subtle = false }: { subtle?: boolean }) {
  return (
    <span className={subtle ? 'text-text-tertiary/40' : 'text-text-tertiary/60'} aria-hidden>
      ·
    </span>
  )
}

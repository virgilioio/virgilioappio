import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { Progress } from '@/components/ui/progress'
import type { FitDimension } from '@/hooks/useCandidateFitInsights'

interface FitDimensionCardProps {
  dimension: FitDimension
}

function getScoreBg(score: number): string {
  if (score >= 80) return 'bg-green-500'
  if (score >= 60) return 'bg-yellow-500'
  if (score >= 40) return 'bg-orange-500'
  return 'bg-red-500'
}

export function FitDimensionCard({ dimension }: FitDimensionCardProps) {
  const [open, setOpen] = useState(false)
  const hasDetail = !!(dimension.insight || dimension.matches?.length || dimension.gaps?.length)

  if (dimension.score === null) {
    return (
      <div className="rounded-lg border border-border p-3 bg-muted/30">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium text-text-primary">{dimension.name}</span>
          <Badge variant="outline" className="text-xs">Data needed</Badge>
        </div>
        {dimension.insight && (
          <p className="text-xs text-text-secondary mt-1">{dimension.insight}</p>
        )}
      </div>
    )
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full" disabled={!hasDetail}>
        <div className="rounded-lg border border-border p-3 hover:bg-accent/5 transition-colors">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              {hasDetail && (
                <ChevronRight className={`h-3.5 w-3.5 text-text-tertiary transition-transform ${open ? 'rotate-90' : ''}`} />
              )}
              <span className="text-sm font-medium text-text-primary">{dimension.name}</span>
            </div>
            <span className="text-sm font-semibold text-text-primary">{dimension.score}</span>
          </div>
          <Progress value={dimension.score} className="h-1.5" />
        </div>
      </CollapsibleTrigger>
      {hasDetail && (
        <CollapsibleContent className="px-3 pb-3 space-y-2">
          {dimension.matches && dimension.matches.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {dimension.matches.map((m) => (
                <Badge key={m} variant="secondary" className="text-xs bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  ✓ {m}
                </Badge>
              ))}
            </div>
          )}
          {dimension.gaps && dimension.gaps.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {dimension.gaps.map((g) => (
                <Badge key={g} variant="secondary" className="text-xs bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
                  ✗ {g}
                </Badge>
              ))}
            </div>
          )}
          {dimension.insight && (
            <p className="text-xs text-text-secondary">{dimension.insight}</p>
          )}
        </CollapsibleContent>
      )}
    </Collapsible>
  )
}

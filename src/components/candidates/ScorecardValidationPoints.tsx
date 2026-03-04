import { useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { CheckCircle2, AlertTriangle, Circle, ChevronDown, ChevronRight, Shield } from 'lucide-react'
import { useCandidateFitInsights, type ValidationPoint } from '@/hooks/useCandidateFitInsights'
import { useValidationPointResolutions, type ValidationPointResolution } from '@/hooks/useValidationPointResolutions'
import { toast } from '@/hooks/use-toast'

interface ScorecardValidationPointsProps {
  candidateId: string
  jobId: string
  associationId: string
  stageName: string
}

function getPriorityColor(priority: string) {
  if (priority === 'high') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
  if (priority === 'medium') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
  return 'bg-muted text-muted-foreground'
}

function StatusIcon({ status }: { status?: string | null }) {
  if (status === 'validated') return <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
  if (status === 'flagged') return <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
  return <Circle className="h-4 w-4 text-muted-foreground flex-shrink-0" />
}

export function ScorecardValidationPoints({
  candidateId,
  jobId,
  associationId,
  stageName,
}: ScorecardValidationPointsProps) {
  const [isOpen, setIsOpen] = useState(true)
  const { insights } = useCandidateFitInsights(candidateId, jobId)
  const { resolutions, resolvePoint, clearResolution } = useValidationPointResolutions(associationId)

  const points = insights?.analysis?.validation_points
  if (!points?.length) return null

  const addressedCount = Array.from({ length: points.length }, (_, i) => resolutions.has(i)).filter(Boolean).length

  // Sort: current stage points first, then by priority
  const priorityOrder: Record<string, number> = { high: 0, medium: 1, low: 2 }
  const sortedPoints = points.map((p, i) => ({ point: p, index: i })).sort((a, b) => {
    const aStageMatch = a.point.suggested_stage?.toLowerCase() === stageName?.toLowerCase() ? 0 : 1
    const bStageMatch = b.point.suggested_stage?.toLowerCase() === stageName?.toLowerCase() ? 0 : 1
    if (aStageMatch !== bStageMatch) return aStageMatch - bStageMatch
    return (priorityOrder[a.point.priority] ?? 2) - (priorityOrder[b.point.priority] ?? 2)
  })

  const handleResolve = async (index: number, question: string, status: 'validated' | 'flagged') => {
    try {
      await resolvePoint(index, question, status, stageName)
      toast({ title: status === 'validated' ? 'Point validated' : 'Point flagged' })
    } catch {
      toast({ title: 'Error', description: 'Failed to update point', variant: 'destructive' })
    }
  }

  const handleClear = async (index: number) => {
    try {
      await clearResolution(index)
    } catch {
      toast({ title: 'Error', description: 'Failed to clear resolution', variant: 'destructive' })
    }
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border border-border rounded-lg">
      <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-accent/50 transition-colors rounded-t-lg">
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Points to Validate</span>
          <Badge variant="secondary" className="text-xs">
            {addressedCount} of {points.length} addressed
          </Badge>
        </div>
        {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </CollapsibleTrigger>

      <CollapsibleContent className="px-4 pb-4 space-y-2">
        {sortedPoints.map(({ point, index }) => {
          const resolution = resolutions.get(index)
          const isResolved = !!resolution
          const isCurrentStage = point.suggested_stage?.toLowerCase() === stageName?.toLowerCase()

          return (
            <div
              key={index}
              className={`rounded-lg border p-3 space-y-2 transition-colors ${
                isResolved ? 'bg-muted/50 border-border' : isCurrentStage ? 'border-pastel-blue/40 bg-pastel-blue/20' : 'border-pastel-blue/30 bg-pastel-blue/10'
              }`}
            >
              <div className="flex items-start gap-2">
                <StatusIcon status={resolution?.status} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isResolved ? 'text-muted-foreground' : 'text-foreground'}`}>
                    {point.question}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{point.reason}</p>
                </div>
              </div>

              <div className="flex items-center justify-between ml-6">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`text-xs ${getPriorityColor(point.priority)}`}>
                    {point.priority}
                  </Badge>
                  <span className="text-xs text-muted-foreground">→ {point.suggested_stage}</span>
                  {isCurrentStage && !isResolved && (
                    <Badge variant="outline" className="text-xs text-primary border-primary/30">This stage</Badge>
                  )}
                </div>

                {isResolved ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {resolution.status === 'validated' ? '✓' : '⚠'} by {resolution.resolver_name} in {resolution.resolved_in_stage}
                    </span>
                    <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => handleClear(index)}>
                      Undo
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-green-700 hover:text-green-800 hover:bg-green-50"
                      onClick={() => handleResolve(index, point.question, 'validated')}
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                      Validated
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 px-2 text-xs text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                      onClick={() => handleResolve(index, point.question, 'flagged')}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                      Flag
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </CollapsibleContent>
    </Collapsible>
  )
}

import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertTriangle, Circle } from 'lucide-react'
import type { ValidationPoint } from '@/hooks/useCandidateFitInsights'

interface ValidationChecklistProps {
  points: ValidationPoint[]
}

function getPriorityColor(priority: string) {
  if (priority === 'high') return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
  if (priority === 'medium') return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
  return 'bg-muted text-text-secondary'
}

function StatusIcon({ status }: { status?: string | null }) {
  if (status === 'validated') return <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0" />
  if (status === 'flagged') return <AlertTriangle className="h-4 w-4 text-orange-500 flex-shrink-0" />
  return <Circle className="h-4 w-4 text-text-tertiary flex-shrink-0" />
}

export function ValidationChecklist({ points }: ValidationChecklistProps) {
  if (!points.length) return null

  return (
    <div className="space-y-2">
      {points.map((point, idx) => (
        <div key={idx} className="rounded-lg border border-border p-3 space-y-1.5">
          <div className="flex items-start gap-2">
            <StatusIcon status={point.status} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-primary">{point.question}</p>
              <p className="text-xs text-text-secondary mt-0.5">{point.reason}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-6">
            <Badge variant="outline" className={`text-xs ${getPriorityColor(point.priority)}`}>
              {point.priority}
            </Badge>
            <span className="text-xs text-text-tertiary">→ {point.suggested_stage}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

import { Badge } from '@/components/ui/badge'
import { CheckCircle2, AlertTriangle, Circle } from 'lucide-react'
import type { ValidationPoint } from '@/hooks/useCandidateFitInsights'

interface ValidationChecklistProps {
  points: ValidationPoint[]
}

function getPriorityStyle(priority: string) {
  if (priority === 'high') return 'bg-virgilio-purple/20 text-virgilio-purple'
  if (priority === 'medium') return 'bg-virgilio-purple/10 text-virgilio-muted'
  return 'bg-muted text-muted-foreground'
}

function StatusIcon({ status }: { status?: string | null }) {
  if (status === 'validated') return <CheckCircle2 className="h-4 w-4 text-virgilio-purple flex-shrink-0" />
  if (status === 'flagged') return <AlertTriangle className="h-4 w-4 text-virgilio-purple/60 flex-shrink-0" />
  return <Circle className="h-4 w-4 text-virgilio-muted flex-shrink-0" />
}

export function ValidationChecklist({ points }: ValidationChecklistProps) {
  if (!points.length) return null

  return (
    <div className="space-y-2">
      {points.map((point, idx) => (
        <div key={idx} className="rounded-lg border border-virgilio-border p-3 space-y-1.5">
          <div className="flex items-start gap-2">
            <StatusIcon status={point.status} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-poppins font-medium text-virgilio-text">{point.question}</p>
              <p className="text-xs text-virgilio-muted font-poppins mt-0.5">{point.reason}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-6">
            <Badge variant="outline" className={`text-xs font-poppins ${getPriorityStyle(point.priority)}`}>
              {point.priority}
            </Badge>
            <span className="text-xs text-virgilio-muted font-poppins">→ {point.suggested_stage}</span>
          </div>
        </div>
      ))}
    </div>
  )
}

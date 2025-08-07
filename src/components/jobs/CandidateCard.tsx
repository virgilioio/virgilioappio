
import { Card } from '@/components/ui/card'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { ExternalLink } from 'lucide-react'
import { JobStage } from '@/hooks/useJobHiringPlan'

interface CandidateCardProps {
  candidateName: string
  linkedinUrl?: string | null
  stageOptions: { jhsId: string; stage: JobStage }[]
  currentStageJhsId?: string | null
  timeInStageLabel?: string
  timeBadgeVariant?: BadgeProps['variant']
  onMove: (toStageId: string) => void | Promise<void>
}

export default function CandidateCard(props: CandidateCardProps) {
  const { candidateName, linkedinUrl, timeInStageLabel, timeBadgeVariant } = props

  return (
    <Card className="relative p-4 min-h-32 bg-white border-border">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <div className="font-medium text-sm text-text-primary truncate">{candidateName}</div>
          </div>
          {linkedinUrl ? (
            <a
              href={linkedinUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary mt-1 hover:underline"
              title="Open LinkedIn"
            >
              <ExternalLink className="w-3.5 h-3.5" /> LinkedIn
            </a>
          ) : (
            <div className="text-xs text-text-tertiary mt-1">No LinkedIn</div>
          )}
        </div>

      </div>

      {timeInStageLabel && (
        <div className="absolute left-4 bottom-3">
          <Badge variant={timeBadgeVariant ?? 'outline'}>{timeInStageLabel}</Badge>
        </div>
      )}
    </Card>
  )
}

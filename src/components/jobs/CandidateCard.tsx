
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge, type BadgeProps } from '@/components/ui/badge'
import { DropdownMenu, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { ExternalLink, MoveRight, MoreVertical } from 'lucide-react'
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

export default function CandidateCard({
  candidateName,
  linkedinUrl,
  stageOptions,
  currentStageJhsId,
  timeInStageLabel,
  timeBadgeVariant,
  onMove,
}: CandidateCardProps) {
  const availableStages = stageOptions.filter(s => s.jhsId !== currentStageJhsId)

  return (
    <Card className="relative p-4 min-h-32 bg-background border-border">
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

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-text-secondary hover:text-text-primary">
              <MoreVertical className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[220px]">
            <DropdownMenuLabel className="text-xs">Move to stage</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              {availableStages.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-text-tertiary">No other stages</div>
              ) : (
                availableStages.map(opt => (
                  <DropdownMenuItem
                    key={opt.jhsId}
                    onClick={() => onMove(opt.jhsId)}
                    className="text-sm"
                  >
                    <MoveRight className="mr-2 h-4 w-4" />
                    <span>{opt.stage.stage_name}</span>
                  </DropdownMenuItem>
                ))
              )}
            </DropdownMenuGroup>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {timeInStageLabel && (
        <div className="absolute left-4 bottom-3">
          <Badge variant={timeBadgeVariant ?? 'outline'}>{timeInStageLabel}</Badge>
        </div>
      )}
    </Card>
  )
}

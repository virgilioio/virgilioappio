import { Badge, type BadgeProps } from '@/components/ui/badge'
import { Send, Clock } from 'lucide-react'
import type { AssociationDetail } from '@/hooks/useCandidateJobAssociations'
import type { ComponentType } from 'react'

interface CandidateJobStatusCellProps {
  associations: AssociationDetail[] | undefined
}

function getStageStatusBadge(a: AssociationDetail): { label: string; variant: BadgeProps['variant']; Icon: ComponentType<{ className?: string }> } | null {
  if (!a.stageName) return null
  if (a.bookingLinkSentAt) return { label: 'Booking link sent', variant: 'secondary', Icon: Send }
  if (a.enteredStageAt) return { label: 'Pending schedule', variant: 'pastel-yellow', Icon: Clock }
  return { label: 'New in stage', variant: 'pastel-yellow', Icon: Clock }
}

function formatShortDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function getPipelineBadge(status: string | null) {
  switch (status?.toLowerCase()) {
    case 'rejected':
      return { label: 'Rejected', variant: 'destructive' as const }
    case 'offer':
      return { label: 'Offer', variant: 'default' as const }
    case 'hired':
      return { label: 'Hired', variant: 'default' as const }
    default:
      return null
  }
}

function getPipelineDate(a: AssociationDetail): string | null {
  const s = a.pipelineStatus?.toLowerCase()
  if (s === 'rejected' && a.rejectedAt) return formatShortDate(a.rejectedAt)
  if (s === 'offer' && a.offeredAt) return formatShortDate(a.offeredAt)
  if (s === 'hired' && a.offeredAt) return formatShortDate(a.offeredAt)
  return null
}

export function CandidateJobStatusCell({ associations }: CandidateJobStatusCellProps) {
  if (!associations || associations.length === 0) {
    return <span className="text-sm text-muted-foreground">—</span>
  }

  // Show the first (most relevant) association
  const primary = associations[0]
  const stageStatus = getStageStatusBadge(primary)
  const pipelineBadge = getPipelineBadge(primary.pipelineStatus)
  const pipelineDate = getPipelineDate(primary)
  const otherCount = associations.length - 1

  return (
    <div className="space-y-0.5 max-w-[280px]">
      {/* Job title */}
      <div className="text-sm font-medium text-foreground truncate">
        {primary.jobTitle}
      </div>

      {/* Stage + status */}
      {primary.stageName && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="truncate">{primary.stageName}</span>
          {stageStatus && (
            <>
              <span>·</span>
              <Badge variant={stageStatus.variant} className="text-[10px] h-4 px-1.5 shrink-0 gap-0.5">
                <stageStatus.Icon className="h-3 w-3" />
                {stageStatus.label}
              </Badge>
            </>
          )}
        </div>
      )}

      {/* Pipeline outcome */}
      {pipelineBadge && (
        <div className="flex items-center gap-1.5 text-xs">
          <Badge
            variant={pipelineBadge.variant}
            className={`text-[10px] h-4 px-1.5 ${
              primary.pipelineStatus?.toLowerCase() === 'hired'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800'
                : primary.pipelineStatus?.toLowerCase() === 'offer'
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                : ''
            }`}
          >
            {pipelineBadge.label}
          </Badge>
          {pipelineDate && (
            <span className="text-muted-foreground">· {pipelineDate}</span>
          )}
        </div>
      )}

      {/* Other jobs */}
      {otherCount > 0 && (
        <div className="text-[11px] text-muted-foreground">
          In {otherCount} other job{otherCount > 1 ? 's' : ''}
        </div>
      )}
    </div>
  )
}

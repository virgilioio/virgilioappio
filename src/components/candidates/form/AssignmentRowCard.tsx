import React from 'react'
import { Briefcase, X } from 'lucide-react'
import { Badge, type BadgeTone } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface AssignmentRowCardProps {
  jobTitle: string
  department?: string | null
  stageName: string | null
  stageTone?: BadgeTone
  onRemove?: () => void
  className?: string
}

/**
 * Read-only row card used by the "Current assignments" section in edit mode.
 * Mirrors the briefcase + title + stage badge + X layout from the mockup.
 */
export function AssignmentRowCard({
  jobTitle,
  department,
  stageName,
  stageTone = 'blue',
  onRemove,
  className,
}: AssignmentRowCardProps) {
  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg ring-1 ring-virgilio-border/60 bg-background px-3 py-2.5',
        className,
      )}
    >
      <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-md bg-muted">
        <Briefcase className="h-4 w-4 text-virgilio-muted" strokeWidth={1.75} />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-virgilio-text">{jobTitle}</p>
        {department && (
          <p className="mt-0.5 truncate text-xs text-virgilio-muted">{department}</p>
        )}
      </div>

      {stageName && (
        <Badge tone={stageTone} dot size="sm">
          {stageName}
        </Badge>
      )}

      {onRemove && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          iconOnly
          aria-label={`Remove from ${jobTitle}`}
          onClick={onRemove}
        >
          <X className="h-4 w-4 text-destructive" strokeWidth={1.75} />
        </Button>
      )}
    </div>
  )
}

export default AssignmentRowCard

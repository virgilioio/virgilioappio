import React from 'react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface CandidateSheetHeaderProps {
  eyebrow?: string
  title: string
  subtitle?: string
  /** Edit mode: render an "In N pipelines" badge inline next to the title */
  pipelineCount?: number
  className?: string
}

/**
 * Sheet header shared between Add and Edit modes.
 * Eyebrow (CANDIDATES, virgilio-purple, 11px caps) → bold title with purple period
 * → optional inline "In N pipelines" pill → subtitle paragraph.
 */
export function CandidateSheetHeader({
  eyebrow = 'Candidates',
  title,
  subtitle,
  pipelineCount,
  className,
}: CandidateSheetHeaderProps) {
  return (
    <div className={cn('space-y-3 pr-10', className)}>
      <p className="font-poppins font-semibold uppercase tracking-[0.08em] text-[11px] text-virgilio-purple">
        {eyebrow}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="font-poppins font-bold text-[28px] leading-none tracking-page-title text-virgilio-text">
          {title}
          <span className="text-purple-period">.</span>
        </h2>
        {typeof pipelineCount === 'number' && pipelineCount > 0 && (
          <Badge tone="blue" dot size="sm">
            In {pipelineCount} pipeline{pipelineCount === 1 ? '' : 's'}
          </Badge>
        )}
      </div>
      {subtitle && (
        <p className="text-sm text-virgilio-muted leading-relaxed">{subtitle}</p>
      )}
    </div>
  )
}

export default CandidateSheetHeader

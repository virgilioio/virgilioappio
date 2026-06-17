import React from 'react'
import { Sparkles } from 'lucide-react'
import { Badge } from '@/components/ui/badge'

interface ResumeStatusBadgeProps {
  parseStep: 'idle' | 'parsing' | 'done'
  enrich: 'idle' | 'working' | 'done'
  parsedFieldsCount?: number
}

/**
 * Right-aligned status badge for the Résumé section header.
 * idle    → lilac sparkles "Gio will auto-fill"
 * parsing → lilac sparkles "Step 1 · parsing"
 * done    → green dot "N fields auto-filled"
 */
export function ResumeStatusBadge({ parseStep, enrich, parsedFieldsCount = 0 }: ResumeStatusBadgeProps) {
  if (parseStep === 'done') {
    return (
      <Badge tone="green" dot size="xs">
        {parsedFieldsCount > 0 ? `${parsedFieldsCount} fields auto-filled` : 'Parsed'}
      </Badge>
    )
  }
  const label = parseStep === 'parsing' ? 'Step 1 · parsing' : 'Gio will auto-fill'
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 h-[18px] font-poppins text-[10.5px] font-semibold"
      style={{ background: '#EDE4FF', color: '#5B21B6' }}
    >
      <Sparkles className={parseStep === 'parsing' ? 'h-3 w-3 gio-pulse' : 'h-3 w-3'} strokeWidth={1.75} />
      {label}
    </span>
  )
}

export default ResumeStatusBadge

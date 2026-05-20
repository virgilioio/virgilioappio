import * as React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Labeled multi-step progress for long flows (onboarding, bulk imports).
 * For unknown duration single steps use Spinner; for known % use LinearProgress.
 */
export interface StepProgressProps {
  steps: { label: string }[]
  /** Zero-based index of the active step. Steps before it are 'done'. */
  current: number
  className?: string
}

export function StepProgress({ steps, current, className }: StepProgressProps) {
  return (
    <ol className={cn('flex items-center gap-2', className)} role="list">
      {steps.map((s, i) => {
        const done = i < current
        const active = i === current
        return (
          <li key={i} className="flex items-center gap-2 min-w-0">
            <span
              className={cn(
                'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-poppins font-semibold transition-colors',
                done && 'bg-[#0d0d09] text-[#fffcf9]',
                active && 'bg-virgilio-purple text-white',
                !done && !active && 'bg-[hsl(var(--tbl-divider-color))] text-text-tertiary',
              )}
            >
              {done ? <Check className="h-3 w-3" /> : i + 1}
            </span>
            <span
              className={cn(
                'truncate text-[12px] font-inter',
                active ? 'text-text-primary font-medium' : 'text-text-tertiary',
              )}
            >
              {s.label}
            </span>
            {i < steps.length - 1 ? (
              <span className="mx-1 h-px w-6 bg-[hsl(var(--tbl-divider-color))] shrink-0" aria-hidden />
            ) : null}
          </li>
        )
      })}
    </ol>
  )
}

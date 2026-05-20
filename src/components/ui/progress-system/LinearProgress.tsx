import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Determinate horizontal bar for known progress (uploads, multi-step jobs).
 * Use IndeterminateBar instead when total is unknown.
 */
export interface LinearProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number
  max?: number
  tone?: 'ink' | 'purple' | 'success'
  /** 2 | 4 | 6 px track height */
  thickness?: 2 | 4 | 6
}

const toneFill = {
  ink: 'bg-[#0d0d09]',
  purple: 'bg-virgilio-purple',
  success: 'bg-success',
} as const

export function LinearProgress({
  value,
  max = 100,
  tone = 'ink',
  thickness = 4,
  className,
  ...props
}: LinearProgressProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn('w-full overflow-hidden rounded-full bg-[hsl(var(--tbl-divider-color))]', className)}
      style={{ height: thickness }}
      {...props}
    >
      <div
        className={cn('h-full rounded-full transition-[width] duration-300 ease-out', toneFill[tone])}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Determinate ring. Use for inline progress indicators (PDF render, upload tile).
 * Indeterminate? Use <Spinner /> instead.
 */
export interface CircularProgressProps extends React.SVGAttributes<SVGSVGElement> {
  value: number
  max?: number
  size?: 14 | 16 | 20 | 24 | 32 | 40
  tone?: 'ink' | 'purple' | 'success'
}

const toneClass = {
  ink: 'text-[#0d0d09]',
  purple: 'text-virgilio-purple',
  success: 'text-success',
} as const

export function CircularProgress({
  value,
  max = 100,
  size = 20,
  tone = 'ink',
  className,
  ...props
}: CircularProgressProps) {
  const pct = Math.max(0, Math.min(1, value / max))
  const r = (size - 4) / 2
  const c = 2 * Math.PI * r
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn('-rotate-90', toneClass[tone], className)}
      role="progressbar"
      aria-valuenow={Math.round(pct * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      {...props}
    >
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeOpacity="0.18" strokeWidth="2" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - pct)}
        className="transition-[stroke-dashoffset] duration-300 ease-out"
      />
    </svg>
  )
}

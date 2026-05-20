import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Gio Foundation v1.0 — Spinner
 * Use for indeterminate waits 1–10s with unknown result shape (no skeleton fit).
 * Pair with a label via <InlineLoader>. Never combine with a skeleton.
 *
 * Honors prefers-reduced-motion: rotation → opacity pulse.
 */
export type SpinnerSize = 12 | 14 | 16 | 20 | 24
export type SpinnerTone = 'ink' | 'purple' | 'cream' | 'muted' | 'current'

const toneClass: Record<SpinnerTone, string> = {
  ink: 'text-[#0d0d09]',
  purple: 'text-virgilio-purple',
  cream: 'text-[#fffcf9]',
  muted: 'text-text-tertiary',
  current: 'text-current',
}

export interface SpinnerProps extends React.SVGAttributes<SVGSVGElement> {
  size?: SpinnerSize
  tone?: SpinnerTone
}

export const Spinner = React.forwardRef<SVGSVGElement, SpinnerProps>(
  ({ size = 16, tone = 'current', className, ...props }, ref) => {
    const stroke = size <= 14 ? 2 : 2.25
    return (
      <svg
        ref={ref}
        width={size}
        height={size}
        viewBox="0 0 24 24"
        fill="none"
        role="status"
        aria-label="Loading"
        className={cn('animate-gio-spin motion-reduce:animate-gio-pulse', toneClass[tone], className)}
        {...props}
      >
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth={stroke} strokeOpacity="0.18" />
        <path
          d="M21 12a9 9 0 0 0-9-9"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
        />
      </svg>
    )
  }
)
Spinner.displayName = 'Spinner'

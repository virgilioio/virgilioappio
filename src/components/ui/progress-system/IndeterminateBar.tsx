import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * 2px sliding bar pinned to the top of a region during background refetch.
 * One per region. Reduced motion → static low-opacity fill.
 */
export interface IndeterminateBarProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 'ink' | 'purple'
  /** When false the bar is hidden (keeps the layout stable). */
  active?: boolean
}

const toneFill = {
  ink: 'bg-[#0d0d09]',
  purple: 'bg-virgilio-purple',
} as const

export function IndeterminateBar({
  tone = 'purple',
  active = true,
  className,
  ...props
}: IndeterminateBarProps) {
  if (!active) return null
  return (
    <div
      role="progressbar"
      aria-busy="true"
      className={cn('relative h-[2px] w-full overflow-hidden bg-transparent', className)}
      {...props}
    >
      <div
        className={cn(
          'absolute inset-y-0 w-1/3 rounded-full',
          'animate-gio-indeterminate motion-reduce:animate-none motion-reduce:opacity-50',
          toneFill[tone],
        )}
      />
    </div>
  )
}

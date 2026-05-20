import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Gio Foundation v1.0 — Shimmer base.
 * Use as the surface for every skeleton silhouette in the app.
 * Reduced motion → static muted fill.
 */
export interface ShimmerProps extends React.HTMLAttributes<HTMLDivElement> {
  rounded?: 'sm' | 'md' | 'lg' | 'full'
}

const roundedMap = {
  sm: 'rounded-[4px]',
  md: 'rounded-md',
  lg: 'rounded-lg',
  full: 'rounded-full',
} as const

export function Shimmer({ rounded = 'sm', className, ...props }: ShimmerProps) {
  return (
    <div
      aria-hidden
      className={cn(
        'relative overflow-hidden bg-[hsl(var(--tbl-divider-color))]/70',
        'before:absolute before:inset-0 before:-translate-x-full',
        'before:bg-gradient-to-r before:from-transparent before:via-white/60 before:to-transparent',
        'before:animate-gio-shimmer motion-reduce:before:hidden',
        roundedMap[rounded],
        className,
      )}
      {...props}
    />
  )
}

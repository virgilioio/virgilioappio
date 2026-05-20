import * as React from 'react'
import { cn } from '@/lib/utils'
import { Spinner, type SpinnerSize, type SpinnerTone } from './Spinner'

/**
 * Spinner + label, single row. Use as the standard "thinking" / "loading…" affordance
 * inside toolbars, panels, AI surfaces. Don't pair with a skeleton in the same region.
 */
export interface InlineLoaderProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode
  size?: SpinnerSize
  tone?: SpinnerTone
}

export function InlineLoader({
  label = 'Loading…',
  size = 14,
  tone = 'muted',
  className,
  ...props
}: InlineLoaderProps) {
  return (
    <div
      role="status"
      className={cn('inline-flex items-center gap-1.5 text-[12px] font-inter text-text-tertiary', className)}
      {...props}
    >
      <Spinner size={size} tone={tone} />
      {label ? <span>{label}</span> : null}
    </div>
  )
}

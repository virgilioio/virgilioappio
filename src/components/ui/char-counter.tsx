import * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * Motion & Feel §12 character counter: hidden until 75% of the limit, then fades in
 * (--dur-hover); tabular numbers; red and semibold at or over the limit. It lives in a
 * reserved line, so appearing never moves the form.
 *
 *   <CharCounterLine count={value.length} max={155}>Shown under the title in search results.</CharCounterLine>
 */
export function CharCounter({ count, max, className }: { count: number; max: number; className?: string }) {
  const shown = count >= Math.ceil(max * 0.75)
  const atLimit = count >= max
  return (
    <span
      className={cn(
        'gio-char-counter shrink-0 tabular-nums',
        atLimit && 'text-virgilio-error font-semibold',
        className,
      )}
      data-visible={shown || undefined}
      aria-hidden={!shown || undefined}
      aria-live="polite"
    >
      {count}/{max}
    </span>
  )
}

/** A reserved 18px hint line with the counter at its end. */
export function CharCounterLine({
  count,
  max,
  children,
  className,
}: {
  count: number
  max: number
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-h-[18px] items-start justify-between gap-3 text-xs leading-[18px]', className)}>
      <span className="min-w-0">{children}</span>
      <CharCounter count={count} max={max} />
    </div>
  )
}

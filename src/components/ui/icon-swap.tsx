import type { ReactNode } from 'react'
import type { LucideIcon, LucideProps } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Motion & Feel §7 copy chips (CLAUDE.md): the first icon shrinks out and the second
 * grows in (scale 0.6 + blur 2px + opacity, --dur-hover, --ease-out). Both stay mounted
 * in one grid cell, so nothing shifts. Reduced motion: a crossfade.
 *
 *   <IconSwap swapped={copied} from={<Copy size={13} />} to={<Check size={13} />} />
 *
 * For a Button `icon` prop use makeSwapIcon(Copy, Check) once at module level and put
 * `data-swapped={copied || undefined}` on the Button.
 */
export function IconSwap({ swapped, from, to, className }: { swapped: boolean; from: ReactNode; to: ReactNode; className?: string }) {
  return (
    <span className={cn('gio-icon-swap', className)} data-swapped={swapped || undefined} aria-hidden>
      <span data-from="">{from}</span>
      <span data-to="">{to}</span>
    </span>
  )
}

/** A stable icon component for Button's `icon` prop; the swap follows `[data-swapped]` on an ancestor. */
export function makeSwapIcon(From: LucideIcon, To: LucideIcon) {
  function SwapIcon(props: LucideProps) {
    return (
      <span className="gio-icon-swap" aria-hidden>
        <span data-from="">
          <From {...props} />
        </span>
        <span data-to="">
          <To {...props} />
        </span>
      </span>
    )
  }
  return SwapIcon as unknown as LucideIcon
}

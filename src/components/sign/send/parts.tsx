import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/** A note inside a send-sheet card: warn (amber) or bad (red). */
export function Note({ tone, icon: Icon, children }: { tone: 'warn' | 'bad' | 'info'; icon: LucideIcon; children: ReactNode }) {
  return (
    <p className="gio-send-note" data-tone={tone} role={tone === 'bad' ? 'alert' : undefined}>
      <Icon className="mt-[2px] h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
      <span className="min-w-0">{children}</span>
    </p>
  )
}

/** How many of the offer's fields the template maps: a 44px ring, green when complete, amber otherwise. */
export function CoverageRing({ mapped, total }: { mapped: number; total: number }) {
  const r = 18
  const c = 2 * Math.PI * r
  const ratio = total ? Math.min(1, mapped / total) : 1
  const complete = mapped >= total
  return (
    <div className="flex items-center gap-2.5">
      <svg width="44" height="44" viewBox="0 0 44 44" aria-hidden className="shrink-0 -rotate-90">
        <circle cx="22" cy="22" r={r} fill="none" stroke="#ECEAE2" strokeWidth="5" />
        <circle
          cx="22"
          cy="22"
          r={r}
          fill="none"
          stroke={complete ? '#12B886' : '#D9A23B'}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - ratio)}
          className="gio-send-ring"
        />
      </svg>
      <div className="font-inter text-[12px] leading-tight">
        <p className="tabular-nums text-text-primary">
          {mapped} of {total}
        </p>
        <p className="text-text-tertiary">offer fields mapped</p>
      </div>
    </div>
  )
}

/** One row of the From the offer list: status icon, label, value or explanation. */
export function FieldRow({
  icon: Icon,
  tone,
  label,
  children,
  clamp,
}: {
  icon: LucideIcon
  tone: 'ok' | 'warn' | 'bad'
  label: string
  children: ReactNode
  clamp?: boolean
}) {
  return (
    <div className="gio-send-row">
      <Icon className={cn('mt-[2px] h-3.5 w-3.5', tone === 'ok' ? 'text-[#16704A]' : tone === 'warn' ? 'text-[#92580A]' : 'text-[#A82E23]')} strokeWidth={2.2} aria-hidden />
      <span className="truncate text-text-secondary">{label}</span>
      <span
        className={cn(
          'min-w-0',
          tone === 'ok' ? 'font-medium text-text-primary' : tone === 'warn' ? 'text-[#92580A]' : 'text-[#A82E23]',
          clamp ? 'line-clamp-2 whitespace-pre-line' : '',
        )}
      >
        {children}
      </span>
    </div>
  )
}

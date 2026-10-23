import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The phone look (2026-10-12): Gio ATS on a phone is a consulting tool for
 * the road — agenda, booking link, scorecards, candidates and jobs at a
 * glance. These are its building blocks, in today's desktop palette:
 * canvas #F6F5F1, white cards with a #E7E8EE hairline, ink #0d0d09,
 * Poppins titles with the lilac period, Inter body.
 */

export function PhonePage({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('bg-virgilio-cream px-4 pt-3 pb-4', className)}>
      {children}
    </div>
  )
}

export function PhoneTitle({ eyebrow, title, sub, action }: { eyebrow?: string; title: string; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-5 flex items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <div className="mb-1 text-[11px] font-inter font-semibold uppercase tracking-[0.12em] text-[#6B7080]">{eyebrow}</div>
        )}
        <h1 className="font-poppins font-semibold text-[26px] leading-[1.15] tracking-[-0.03em] text-[#0d0d09] line-clamp-3">
          {title}<span className="text-[#D7C5FB]">.</span>
        </h1>
        {sub && <div className="mt-1.5 text-[13.5px] leading-[1.5] font-inter text-[#5A6072]">{sub}</div>}
      </div>
      {action && <div className="shrink-0 pt-1">{action}</div>}
    </div>
  )
}

export function PhoneSection({ label, count, action, children, className }: {
  label: string
  count?: number | null
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cn('mb-6', className)}>
      <div className="mb-2 flex items-center justify-between gap-2 px-1">
        <h2 className="flex items-center gap-2 font-poppins font-semibold text-[14px] tracking-[-0.01em] text-[#0d0d09]">
          {label}
          {typeof count === 'number' && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#EDEAE2] px-1.5 text-[11px] font-inter font-semibold tabular-nums text-[#5A6072]">
              {count}
            </span>
          )}
        </h2>
        {action}
      </div>
      {children}
    </section>
  )
}

export function PhoneCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-[14px] border border-[#E7E8EE] bg-white', className)}>
      {children}
    </div>
  )
}

/** One tappable line in a card: leading visual, two lines of text, a trailing bit. */
export function PhoneRow({ to, onClick, leading, title, meta, trailing, chevron = true }: {
  to?: string
  onClick?: () => void
  leading?: ReactNode
  title: ReactNode
  meta?: ReactNode
  trailing?: ReactNode
  chevron?: boolean
}) {
  const body = (
    <>
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate font-inter font-semibold text-[14px] text-[#0d0d09]">{title}</div>
        {meta && <div className="mt-0.5 truncate font-inter text-[12.5px] text-[#5A6072]">{meta}</div>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
      {chevron && (to || onClick) && <ChevronRight className="h-4 w-4 shrink-0 text-[#B5B9C4]" />}
    </>
  )
  const cls = 'gio-pressable flex w-full items-center gap-3 px-4 py-3 text-left border-b border-[#F1F0EC] last:border-b-0 active:bg-[#FAFAF7]'
  if (to) return <Link to={to} className={cls}>{body}</Link>
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{body}</button>
  return <div className={cls.replace('gio-pressable ', '')}>{body}</div>
}

export function Initials({ name, size = 36, tone = 'lilac' }: { name: string | null | undefined; size?: number; tone?: 'lilac' | 'ink' }) {
  const text = (name ?? '')
    .split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() ?? '').join('') || '?'
  return (
    <span
      aria-hidden="true"
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-poppins font-semibold',
        tone === 'lilac' ? 'bg-[#EDE4FF] text-[#5B21B6]' : 'bg-[#0d0d09] text-[#fffcf9]',
      )}
      style={{ width: size, height: size, fontSize: Math.max(10.5, Math.round(size * 0.36)) }}
    >
      {text}
    </span>
  )
}

export function Pill({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'purple' | 'green' | 'amber' | 'red' }) {
  const tones = {
    neutral: 'bg-[#F1F0EC] text-[#5A6072]',
    purple: 'bg-[#EDE4FF] text-[#5B21B6]',
    green: 'bg-[#DCFBE9] text-[#0B7A52]',
    amber: 'bg-[#FEF3C7] text-[#92400E]',
    red: 'bg-[#FEE2E2] text-[#B91C1C]',
  }
  return (
    <span className={cn('inline-flex h-[22px] max-w-full items-center whitespace-nowrap rounded-full px-2 text-[11.5px] font-inter font-semibold tabular-nums', tones[tone])}>
      <span className="truncate">{children}</span>
    </span>
  )
}

export function PhoneEmpty({ children }: { children: ReactNode }) {
  return <div className="px-4 py-5 text-center font-inter text-[13px] text-[#6B7080]">{children}</div>
}

export function PhoneSkeletonRows({ rows = 3 }: { rows?: number }) {
  return (
    <div aria-hidden="true">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 border-b border-[#F1F0EC] px-4 py-3 last:border-b-0">
          <span className="gio-shimmer block h-9 w-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <span className="gio-shimmer block h-3 w-1/2 rounded" />
            <span className="gio-shimmer block h-3 w-1/3 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

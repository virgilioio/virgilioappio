/**
 * MetricStrip — single horizontal card with N MetricCells.
 * Strict spec: white card, radius 12, border #E7E8EE, padding 0, ~56h.
 * Cells flex-1, separated by 1px #F1F0EC vertical dividers.
 * One strip per page.
 */
import { ArrowDown, ArrowUp, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

export type MetricTone = 'purple' | 'yellow' | 'green' | 'blue' | 'pink' | 'neutral'

const TONE: Record<MetricTone, { bg: string; fg: string }> = {
  purple:  { bg: '#EDE4FF', fg: '#6F3FF5' },
  yellow:  { bg: '#FEF3C7', fg: '#B45309' },
  green:   { bg: '#D1FAE5', fg: '#12B886' },
  blue:    { bg: '#DBEAFE', fg: '#2563EB' },
  pink:    { bg: '#FCE7F3', fg: '#BE185D' },
  neutral: { bg: '#F1F0EC', fg: '#1F2230' },
}

export type MetricDelta = {
  value: number
  /** 'up' or 'down' arrow direction. */
  direction: 'up' | 'down'
  /** Whether this change is improving (green) or worsening (red). Default: improving. */
  improving?: boolean
}

export interface MetricItem {
  icon: LucideIcon
  tone: MetricTone
  label: string
  value: number | string
  /** Optional unit suffix like "d". */
  unit?: string
  /** Delta qualifier (mutually exclusive with annotation). */
  delta?: MetricDelta
  /** Amber annotation qualifier, e.g. "3 over 5 days". */
  annotation?: string
  /** Treat value as zero state (muted). Auto-detected when value === 0. */
  isZero?: boolean
}

export function MetricStrip({ items }: { items: MetricItem[] }) {
  return (
    <div
      className="flex w-full overflow-hidden rounded-[12px] bg-white"
      style={{ border: '1px solid #E7E8EE' }}
    >
      {items.map((it, i) => (
        <div
          key={i}
          className="flex-1 min-w-0"
          style={i > 0 ? { borderLeft: '1px solid #F1F0EC' } : undefined}
        >
          <MetricCell {...it} />
        </div>
      ))}
    </div>
  )
}

function MetricCell({ icon: Icon, tone, label, value, unit, delta, annotation, isZero }: MetricItem) {
  const t = TONE[tone]
  const zero = isZero ?? (value === 0 || value === '0')
  const valueColor = zero ? '#B5B9C4' : '#0d0d09'
  const chipBg = zero ? '#F1F0EC' : t.bg
  const chipFg = zero ? '#8B8F9E' : t.fg

  return (
    <div className="flex items-center" style={{ gap: 10, padding: '12px 16px' }}>
      <div
        className="flex shrink-0 items-center justify-center"
        style={{ width: 28, height: 28, borderRadius: 8, background: chipBg, color: chipFg }}
      >
        <Icon size={14} strokeWidth={2} />
      </div>
      <div className="flex min-w-0 flex-col">
        <div
          className="truncate font-inter"
          style={{ fontSize: 11, fontWeight: 500, color: '#8B8F9E', lineHeight: 1.2 }}
        >
          {label}
        </div>
        <div className="flex items-baseline gap-1.5">
          <span
            className="font-poppins tabular-nums"
            style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.03em', color: valueColor, lineHeight: 1.15 }}
          >
            {value}
            {unit ? (
              <span style={{ fontSize: 12, fontWeight: 500, color: '#5A6072', marginLeft: 1 }}>{unit}</span>
            ) : null}
          </span>
          {delta && !annotation ? <Delta {...delta} /> : null}
          {annotation ? (
            <span
              className="font-inter"
              style={{ fontSize: 10.5, fontWeight: 500, color: '#B45309' }}
            >
              {annotation}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  )
}

function Delta({ value, direction, improving = true }: MetricDelta) {
  const color = improving ? '#12B886' : '#FA5252'
  const Arrow = direction === 'up' ? ArrowUp : ArrowDown
  return (
    <span
      className={cn('inline-flex items-center font-inter tabular-nums')}
      style={{ gap: 2, fontSize: 10.5, fontWeight: 600, color }}
    >
      <Arrow size={10} strokeWidth={2.5} />
      {value}
    </span>
  )
}

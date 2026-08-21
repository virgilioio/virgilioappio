import { Flag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ReferencesGlyph } from '@/components/icons/ReferencesGlyph'
import {
  REF_STATE_LABEL,
  REF_STATE_TONE,
  type RefRequestState,
  type RefTone,
} from '@/lib/references/status'

const TONE: Record<RefTone, { bg: string; fg: string }> = {
  green: { bg: '#D1FAE5', fg: '#065F46' },
  red: { bg: '#FEE2E2', fg: '#991B1B' },
  yellow: { bg: '#FEF3C7', fg: '#92400E' },
  orange: { bg: '#FFEDD5', fg: '#9A3412' },
  blue: { bg: '#DBEAFE', fg: '#1E40AF' },
  purple: { bg: '#EDE4FF', fg: '#5B21B6' },
  neutral: { bg: '#F1F0EC', fg: '#5A6072' },
}

const SIZE = {
  xs: { h: 'h-[18px]', px: 'px-1.5', gap: 'gap-1', text: '10.5px', glyph: 9 },
  sm: { h: 'h-[22px]', px: 'px-2', gap: 'gap-1.5', text: '11.5px', glyph: 11 },
  md: { h: 'h-[26px]', px: 'px-2.5', gap: 'gap-1.5', text: '12.5px', glyph: 13 },
} as const

export interface RefStatusProps {
  state: RefRequestState
  /** flagged is a MODIFIER, not a state — a request can be partial AND flagged. */
  flagged?: boolean
  /** Pre-formatted counts string from formatCounts(). Never a percentage. */
  counts?: string
  size?: keyof typeof SIZE
  showLabel?: boolean
  note?: string
  className?: string
}

export function RefStatus({
  state,
  flagged = false,
  counts,
  size = 'sm',
  showLabel = true,
  note,
  className,
}: RefStatusProps) {
  const tone = flagged ? 'orange' : REF_STATE_TONE[state]
  const t = TONE[tone]
  const s = SIZE[size]

  const segments = [
    showLabel ? REF_STATE_LABEL[state] : null,
    state !== 'none' && counts ? counts : null,
    flagged ? 'flagged' : null,
  ].filter(Boolean) as string[]

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md font-inter font-medium whitespace-nowrap',
        s.h,
        s.px,
        s.gap,
        className
      )}
      style={{ backgroundColor: t.bg, color: t.fg, fontSize: s.text, letterSpacing: '0.01em' }}
      title={note || segments.join(' · ')}
    >
      <ReferencesGlyph
        className={cn('shrink-0', state === 'none' && '[&_.accent]:fill-current')}
      />

      {segments.length > 0 && <span className="truncate">{segments.join(' · ')}</span>}
      {flagged && <Flag className="shrink-0" style={{ width: s.glyph, height: s.glyph }} />}
    </span>
  )
}

export default RefStatus

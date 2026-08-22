import { Flag } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RefGlyph } from '@/components/references/RefGlyph'
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

/** Dot colour per state — the glyph accent inside the pill. */
const STATE_DOT: Record<RefRequestState, string> = {
  none: '#B5B9C4',
  draft: '#B5B9C4',
  candidate: '#F59E0B',
  referees: '#0EA5E9',
  partial: '#0EA5E9',
  complete: '#12B886',
  attention: '#FA5252',
  expired: '#B5B9C4',
  cancelled: '#B5B9C4',
}

const SIZE = {
  xs: { h: 20, text: 10.5, px: 7, glyph: 11, flag: 9.5 },
  sm: { h: 22, text: 11, px: 9, glyph: 13, flag: 11 },
  md: { h: 26, text: 12, px: 9, glyph: 13, flag: 11 },
} as const

export interface RefStatusProps {
  state: RefRequestState
  /** flagged is a MODIFIER, not a state — a request can be partial AND flagged. */
  flagged?: boolean
  /**
   * Pre-formatted counts string from formatCounts() — or formatCountsCompact()
   * for the compact pipeline form. Never a percentage.
   */
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

  const accent = state === 'none' ? t.fg : flagged ? '#F97316' : STATE_DOT[state]

  return (
    <span
      className={cn('inline-flex items-center font-inter whitespace-nowrap', className)}
      style={{
        gap: 6,
        height: s.h,
        padding: `0 ${s.px}px`,
        borderRadius: 999,
        fontSize: s.text,
        fontWeight: 500,
        backgroundColor: t.bg,
        color: t.fg,
      }}
      title={note || [showLabel ? REF_STATE_LABEL[state] : null, counts].filter(Boolean).join(' · ')}
    >
      <span className="inline-flex shrink-0">
        <RefGlyph size={s.glyph} color={t.fg} accent={accent} />
      </span>

      {showLabel && <span className="truncate">{REF_STATE_LABEL[state]}</span>}

      {counts && (
        <span className="tabular-nums" style={{ opacity: 0.75 }}>
          {counts}
        </span>
      )}

      {flagged && (
        <span className="inline-flex items-center" style={{ gap: 3, opacity: 0.9 }}>
          <Flag size={s.flag} strokeWidth={2.2} />
          flagged
        </span>
      )}

      {note && <span style={{ opacity: 0.75 }}>· {note}</span>}
    </span>
  )
}

export default RefStatus

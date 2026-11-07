import { Sparkles } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { BlendNumber } from '@/components/ui/blend-number'
import { minutesUntil, useFitQueueEntry } from '@/lib/fitQueueStatus'
import { cn } from '@/lib/utils'

/**
 * A candidate's Gio Fit score in a job's lists and board (2026-11-08): the section
 * tables' Match column (`cell`), the list view (`cell`, `inline` on phones) and the
 * board card's chip (`chip`). While the candidate is queued for Gio Fit the sparkle
 * turns into a small spinner (a still ring with reduced motion) and the old score
 * fades to half; the new score blends in (`BlendNumber`) and the cell flashes once.
 * The tooltip names it: "Gio Fit score 72".
 */
interface GioFitScoreProps {
  associationId?: string | null
  score?: number | null
  variant: 'cell' | 'inline' | 'chip'
  /** The score's colour (each view keeps its own palette). */
  color: string
  /** The chip's tint behind the score. */
  tint?: string
  /** No score and not queued: a plain dash in this colour (the section tables). */
  emptyColor?: string
}

function tipFor(score: number | null, due: boolean | undefined, dueAt: string | undefined) {
  if (dueAt && due === false) {
    const n = minutesUntil(dueAt)
    return `Re-scoring in about ${n} minute${n === 1 ? '' : 's'}, against the new job details.`
  }
  if (due) return score === null ? 'Gio is scoring this candidate.' : 'Gio is re-scoring this candidate. The old score stays until then.'
  return score === null ? 'No Gio Fit score yet' : `Gio Fit score ${score}`
}

export function GioFitScore({ associationId, score: raw, variant, color, tint, emptyColor }: GioFitScoreProps) {
  const score = typeof raw === 'number' ? Math.round(raw) : null
  const { entry, justScored } = useFitQueueEntry(associationId)
  const queued = !!entry
  const label = tipFor(score, entry?.due, entry?.dueAt)
  const iconSize = variant === 'chip' ? 10 : 11

  const icon = queued ? (
    <span
      aria-hidden
      className="gio-spinner gio-spinner-current shrink-0"
      style={{ width: iconSize, height: iconSize, borderWidth: 1.5 }}
    />
  ) : (
    <Sparkles aria-hidden size={iconSize} strokeWidth={2.25} className="shrink-0" />
  )

  const number = (
    <span
      style={{ opacity: queued ? 0.5 : 1, transition: 'opacity var(--dur-hover) ease' }}
      className={variant === 'chip' ? undefined : 'tabular-nums'}
    >
      {score === null ? '—' : (
        <BlendNumber id={`gio-fit-${associationId ?? 'x'}`} value={score} count={false} />
      )}
    </span>
  )

  const body =
    emptyColor && score === null && !queued ? (
      <span
        className="inline-flex justify-end"
        style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: emptyColor }}
        role="img"
        aria-label={label}
      >
        —
      </span>
    ) : variant === 'chip' ? (
      <span
        className={cn('relative inline-flex items-center', justScored && 'gio-saved-flash gio-fit-flash')}
        style={{
          gap: 4,
          padding: score === null && !queued ? 0 : '2px 6px',
          borderRadius: 999,
          background: score === null ? 'transparent' : tint,
          fontFamily: 'Inter, sans-serif',
          fontSize: 10.5,
          fontWeight: 600,
          color,
        }}
        role="img"
        aria-label={label}
      >
        {icon}
        {number}
      </span>
    ) : variant === 'inline' ? (
      <span
        className={cn('relative inline-flex items-center tabular-nums', justScored && 'gio-saved-flash gio-fit-flash')}
        style={{ gap: 3, color, borderRadius: 4 }}
        role="img"
        aria-label={label}
      >
        {icon}
        <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 600 }}>{number}</span>
      </span>
    ) : (
      <span
        className={cn('relative inline-flex items-center justify-end', justScored && 'gio-saved-flash gio-fit-flash')}
        style={{ gap: 4, color, borderRadius: 4, padding: '0 2px' }}
        role="img"
        aria-label={label}
      >
        {icon}
        <span style={{ fontFamily: 'Poppins, sans-serif', fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.02em' }}>
          {number}
        </span>
      </span>
    )

  return (
    <Tooltip>
      <TooltipTrigger asChild>{body}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

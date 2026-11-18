import { ArrowDown, ArrowUp, Sparkles } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { BlendNumber } from '@/components/ui/blend-number'
import { fitMoveText, minutesUntil, useFitMove, useFitQueueEntry, type FitMove } from '@/lib/fitQueueStatus'
import { cn } from '@/lib/utils'

/**
 * A candidate's Gio Fit score in a job's lists and board (2026-11-08): the section
 * tables' Match column (`cell`), the list view (`cell`, `inline` on phones) and the
 * board card's chip (`chip`). While the candidate is queued for Gio Fit the sparkle
 * turns into a small spinner (a still ring with reduced motion) and the old score
 * fades to half; the new score blends in (`BlendNumber`) and the cell flashes once.
 * The tooltip names it: "Gio Fit score 72".
 *
 * A score that moved for a reason (2026-11-17, `useFitMove`) carries a small arrow
 * with the points (`cell`, `inline`) or the arrow alone (`chip`), green up and red
 * down, and the tooltip says why: "Gio Fit score 78, up 8 after a scorecard on Nov 17".
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

const MOVE_UP = '#1F7A4D'
const MOVE_DOWN = 'var(--color-danger)'

function tipFor(score: number | null, due: boolean | undefined, dueAt: string | undefined, move?: FitMove) {
  if (dueAt && due === false) {
    const n = minutesUntil(dueAt)
    return `Re-scoring in about ${n} minute${n === 1 ? '' : 's'}, against the new job details.`
  }
  if (due) return score === null ? 'Gio is scoring this candidate.' : 'Gio is re-scoring this candidate. The old score stays until then.'
  if (score === null) return 'No Gio Fit score yet'
  return move ? `Gio Fit score ${score}, ${fitMoveText(move)}` : `Gio Fit score ${score}`
}

export function GioFitScore({ associationId, score: raw, variant, color, tint, emptyColor }: GioFitScoreProps) {
  const score = typeof raw === 'number' ? Math.round(raw) : null
  const { entry, justScored } = useFitQueueEntry(associationId)
  const queued = !!entry
  // A move belongs to the score on screen: not while a new one is on its way.
  const found = useFitMove(associationId)
  const move = !queued && score !== null ? found : undefined
  const label = tipFor(score, entry?.due, entry?.dueAt, move)
  const iconSize = variant === 'chip' ? 10 : 11

  const MoveIcon = move && move.delta > 0 ? ArrowUp : ArrowDown
  const marker = move ? (
    <span
      aria-hidden
      data-fit-move={move.delta > 0 ? 'up' : 'down'}
      className="inline-flex shrink-0 items-center tabular-nums"
      style={{ gap: 1, color: move.delta > 0 ? MOVE_UP : MOVE_DOWN, fontFamily: 'Inter, sans-serif', fontSize: 10, fontWeight: 600, lineHeight: 1, letterSpacing: 0 }}
    >
      <MoveIcon size={variant === 'chip' ? 9 : 10} strokeWidth={2.5} />
      {variant === 'chip' ? null : Math.abs(move.delta)}
    </span>
  ) : null

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
        {marker}
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
        {marker}
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
        {marker}
      </span>
    )

  return (
    <Tooltip>
      <TooltipTrigger asChild>{body}</TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  )
}

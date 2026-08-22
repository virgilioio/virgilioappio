import { cn } from '@/lib/utils'
import {
  REFEREE_STATUS_LABEL,
  type RefereeLike,
  type RefereeStatus,
} from '@/lib/references/status'

const SEG_COLOR: Record<RefereeStatus, string> = {
  submitted: '#12B886',
  logged: '#6F3FF5',
  in_progress: '#F59E0B',
  opened: '#0EA5E9',
  invited: '#BFDBFE',
  on_hold: '#FDBA74',
  declined: '#FCA5A5',
  bounced: '#FCA5A5',
  pending: '#E7E8EE',
}

export interface RefereeTrackProps {
  referees: RefereeLike[]
  /** Pads the track with empty segments up to the required count. */
  requiredCount?: number
  /** Track width in px. */
  width?: number
  className?: string
}

/** One segment per referee, in submission order, colour-coded by status. */
export function RefereeTrack({ referees, requiredCount, width = 90, className }: RefereeTrackProps) {
  const ordered = [...referees].sort((a, b) => {
    const ta = a.submitted_at ? Date.parse(a.submitted_at) : Number.MAX_SAFE_INTEGER
    const tb = b.submitted_at ? Date.parse(b.submitted_at) : Number.MAX_SAFE_INTEGER
    return ta - tb
  })

  const placeholders = Math.max(0, (requiredCount ?? 0) - ordered.length)

  return (
    <span
      className={cn('inline-flex items-center', className)}
      style={{ gap: 2, height: 5, width }}
    >
      {ordered.map((r, i) => (
        <span
          key={r.id ?? i}
          title={REFEREE_STATUS_LABEL[r.status]}
          style={{
            flex: 1,
            height: 5,
            borderRadius: 999,
            background: SEG_COLOR[r.on_hold === true ? 'on_hold' : r.status],
          }}
        />
      ))}
      {Array.from({ length: placeholders }).map((_, i) => (
        <span
          key={`empty-${i}`}
          title="Referee not yet added"
          style={{ flex: 1, height: 5, borderRadius: 999, background: SEG_COLOR.pending }}
        />
      ))}
    </span>
  )
}

export default RefereeTrack

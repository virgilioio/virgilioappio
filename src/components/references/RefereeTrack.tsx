import { cn } from '@/lib/utils'
import {
  REFEREE_STATUS_LABEL,
  REFEREE_STATUS_TONE,
  type RefereeLike,
  type RefTone,
} from '@/lib/references/status'

const SEG_COLOR: Record<RefTone, string> = {
  green: '#34D399',
  red: '#F87171',
  yellow: '#FBBF24',
  orange: '#FB923C',
  blue: '#60A5FA',
  purple: '#A78BFA',
  neutral: '#DCDAD3',
}

export interface RefereeTrackProps {
  referees: RefereeLike[]
  /** Pads the track with empty segments up to the required count. */
  requiredCount?: number
  className?: string
}

/** One thin segment per referee, in submission order, colour-coded by status. */
export function RefereeTrack({ referees, requiredCount, className }: RefereeTrackProps) {
  const ordered = [...referees].sort((a, b) => {
    const ta = a.submitted_at ? Date.parse(a.submitted_at) : Number.MAX_SAFE_INTEGER
    const tb = b.submitted_at ? Date.parse(b.submitted_at) : Number.MAX_SAFE_INTEGER
    return ta - tb
  })

  const placeholders = Math.max(0, (requiredCount ?? 0) - ordered.length)

  return (
    <span className={cn('inline-flex items-center gap-[3px]', className)} aria-hidden={false}>
      {ordered.map((r, i) => (
        <span
          key={r.id ?? i}
          title={REFEREE_STATUS_LABEL[r.status]}
          className="h-[3px] w-4 rounded-full"
          style={{
            backgroundColor: SEG_COLOR[
              r.on_hold === true ? 'yellow' : REFEREE_STATUS_TONE[r.status]
            ],
          }}
        />
      ))}
      {Array.from({ length: placeholders }).map((_, i) => (
        <span
          key={`empty-${i}`}
          title="Referee not yet added"
          className="h-[3px] w-4 rounded-full"
          style={{ backgroundColor: '#EDEBE5' }}
        />
      ))}
    </span>
  )
}

export default RefereeTrack

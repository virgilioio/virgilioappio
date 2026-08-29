/**
 * Placeholder track for the awaiting-candidate state: one grey segment per
 * REQUIRED referee. Same geometry as <RefereeTrack> so the card does not jump
 * when real referees arrive — and never a spinner or a 0% bar, because the
 * empty slots are what communicate how many referees are expected.
 */
import { cn } from '@/lib/utils'

export function EmptyRefereeTrack({
  count,
  width = 72,
  className,
}: {
  count: number
  width?: number
  className?: string
}) {
  const n = Math.max(1, count)
  return (
    <span
      className={cn('inline-flex items-center', className)}
      style={{ gap: 2, height: 5, width }}
    >
      {Array.from({ length: n }).map((_, i) => (
        <span
          key={i}
          title="Referee not yet added"
          style={{ flex: 1, height: 5, borderRadius: 999, background: '#E7E8EE' }}
        />
      ))}
    </span>
  )
}

export default EmptyRefereeTrack

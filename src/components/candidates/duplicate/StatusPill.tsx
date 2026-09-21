import { cn } from '@/lib/utils'
import type { DupStatus } from './types'

const TONES: Record<DupStatus, { wrap: string; dot: string; label: string }> = {
  active:    { wrap: 'bg-dup-blue-bg text-dup-blue-fg',         dot: 'bg-dup-blue-dot',  label: 'Active' },
  offered:   { wrap: 'bg-dup-purple-soft text-dup-purple-deep', dot: 'bg-dup-purple',    label: 'Offered' },
  rejected:  { wrap: 'bg-dup-red-bg text-dup-red-fg',           dot: 'bg-dup-red-dot',   label: 'Rejected' },
  hired:     { wrap: 'bg-dup-green-bg text-dup-green-fg',       dot: 'bg-dup-green-dot', label: 'Hired' },
  withdrawn: { wrap: 'bg-dup-hairline text-dup-muted',          dot: 'bg-dup-faint',     label: 'Withdrawn' },
}

export function StatusPill({
  status,
  size = 'md',
  className,
}: {
  status: DupStatus
  size?: 'md' | 'sm'
  className?: string
}) {
  const tone = TONES[status] ?? TONES.active
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full font-inter font-semibold',
        tone.wrap,
        className,
      )}
      style={{ height: size === 'sm' ? 19 : 22, padding: '0 9px', fontSize: 11 }}
    >
      <span className={cn('inline-block rounded-full', tone.dot)} style={{ width: 5, height: 5 }} />
      {tone.label}
    </span>
  )
}

export const statusLabel = (s: DupStatus) => (TONES[s] ?? TONES.active).label

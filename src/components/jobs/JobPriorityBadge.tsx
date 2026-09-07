import { jobPriorityMeta, isLoudJobPriority, type JobPriority } from '@/lib/job-priority'

interface JobPriorityBadgeProps {
  value?: JobPriority | string | null
  /** In dense lists, standard/low render dot-only so the list doesn't turn into confetti. */
  quietLowPriority?: boolean
}

export function JobPriorityBadge({ value, quietLowPriority }: JobPriorityBadgeProps) {
  const p = jobPriorityMeta(value)
  const loud = isLoudJobPriority(p.id)

  if (quietLowPriority && !loud) {
    return (
      <span
        title={`Priority: ${p.label}`}
        aria-label={`Priority: ${p.label}`}
        style={{ width: 7, height: 7, borderRadius: 999, background: p.dot, display: 'inline-block', flex: '0 0 7px' }}
      />
    )
  }

  return (
    <span
      className="inline-flex items-center whitespace-nowrap"
      style={{
        gap: 5,
        padding: '3px 9px',
        borderRadius: 999,
        background: p.tint,
        color: p.ink,
        fontFamily: 'Inter, sans-serif',
        fontSize: 11.5,
        fontWeight: 600,
      }}
    >
      <span aria-hidden style={{ width: 7, height: 7, borderRadius: 999, background: p.dot, flex: '0 0 7px' }} />
      {p.label}
    </span>
  )
}

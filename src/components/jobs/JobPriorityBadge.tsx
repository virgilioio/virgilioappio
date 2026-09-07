import { jobPriorityMeta, isLoudJobPriority, type JobPriority } from '@/lib/job-priority'

interface JobPriorityBadgeProps {
  value?: JobPriority | string | null
  /** Alias so callers can pass `priority` directly. */
  priority?: JobPriority | string | null
  /** In very dense rows, standard/low can render dot-only. */
  quietLowPriority?: boolean
}

export function JobPriorityBadge({ value, priority, quietLowPriority }: JobPriorityBadgeProps) {
  const p = jobPriorityMeta(priority ?? value)
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
        padding: loud ? '3px 9px' : '3px 8px 3px 6px',
        borderRadius: 999,
        background: loud ? p.tint : 'transparent',
        color: loud ? p.ink : '#8B8F9E',
        fontFamily: 'Inter, sans-serif',
        fontSize: 11,
        fontWeight: loud ? 600 : 500,
      }}
    >
      <span aria-hidden style={{ width: 6, height: 6, borderRadius: 999, background: p.dot, flex: '0 0 6px' }} />
      {p.label}
    </span>
  )
}

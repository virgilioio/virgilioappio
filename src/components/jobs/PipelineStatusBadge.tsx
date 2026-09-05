import { CalendarCheck, CalendarPlus, CalendarX, ClipboardCheck, Scale, Send } from 'lucide-react'
import type { CandidateStatusInfo, CandidateStatusKind } from '@/hooks/usePipelineCandidateStatuses'

type Tone = { bg: string; fg: string; border: string; detail: string }

const TONES: Record<CandidateStatusKind, Tone> = {
  decision: { bg: '#0d0d09', fg: '#fffcf9', border: '#0d0d09', detail: 'rgba(255,252,249,0.65)' },
  scorecard: { bg: '#FEF3C7', fg: '#92400E', border: '#FDE68A', detail: '' },
  scheduled: { bg: '#DBEAFE', fg: '#1E40AF', border: '#BFDBFE', detail: '' },
  scheduled_overdue: { bg: '#FEE2E2', fg: '#B91C1C', border: '#FECACA', detail: '' },
  needs_scheduling: { bg: '#EDE4FF', fg: '#5B21B6', border: '#D7C5FB', detail: '' },
  link_sent: { bg: '#fff', fg: '#5A6072', border: '#E7E8EE', detail: '#8B8F9E' },
}

const ICONS: Record<CandidateStatusKind, typeof Scale> = {
  decision: Scale,
  scorecard: ClipboardCheck,
  scheduled: CalendarCheck,
  scheduled_overdue: CalendarX,
  needs_scheduling: CalendarPlus,
  link_sent: Send,
}

const LABELS: Record<CandidateStatusKind, string> = {
  decision: 'Decision needed',
  scorecard: 'Scorecard needed',
  scheduled: 'Scheduled',
  scheduled_overdue: 'Scheduled',
  needs_scheduling: 'Needs scheduling',
  link_sent: 'Booking link sent',
}

interface Props {
  status: CandidateStatusInfo | null | undefined
  /** Show the trailing `· detail` hint. */
  detail?: boolean
  /** Fill the container's width instead of hugging content. */
  block?: boolean
}

/**
 * The one badge a candidate-in-job gets. Purely presentational: everything it shows
 * comes from `usePipelineCandidateStatuses`. Never recompute state here.
 */
export function PipelineStatusBadge({ status, detail = true, block = false }: Props) {
  if (!status) {
    return (
      <span style={{ fontFamily: 'Inter, sans-serif', fontSize: 12, color: '#8B8F9E' }}>—</span>
    )
  }

  const isScheduled = status.kind === 'scheduled' || status.kind === 'scheduled_overdue'
  const tone = TONES[status.kind]
  const Icon = ICONS[status.kind]
  const label = isScheduled
    ? (status.day ? `${status.day} · ${status.time ?? ''}`.trim() : status.when || LABELS[status.kind])
    : LABELS[status.kind]

  return (
    <span
      style={{
        display: block ? 'flex' : 'inline-flex',
        alignItems: 'center',
        gap: 5,
        maxWidth: '100%',
        minWidth: 0,
        padding: '3px 7px',
        borderRadius: 6,
        background: tone.bg,
        border: `1px solid ${tone.border}`,
        color: tone.fg,
        fontFamily: 'Inter, sans-serif',
        fontSize: 11,
        fontWeight: 500,
        lineHeight: 1.35,
      }}
    >
      <Icon size={11} strokeWidth={2} style={{ flexShrink: 0 }} />
      <span
        style={{
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
          fontWeight: isScheduled ? 600 : 500,
        }}
      >
        {label}
      </span>
      {detail && status.detail ? (
        <span
          style={{
            flexShrink: 0,
            fontWeight: 400,
            color: tone.detail || undefined,
            opacity: tone.detail ? 1 : 0.72,
          }}
        >
          · {status.detail}
        </span>
      ) : null}
    </span>
  )
}

export default PipelineStatusBadge

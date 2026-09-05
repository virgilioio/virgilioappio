import * as React from 'react'
import {
  AlertTriangle,
  Check,
  CircleDashed,
  CircleSlash,
  GitBranch,
  Send,
  StickyNote,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { matchColor } from './suggestedGrid'
import type { SuggestedStatus } from '@/hooks/useSuggestedCandidateStatus'

const inter = "'Inter', system-ui, sans-serif"
const poppins = "'Poppins', system-ui, sans-serif"

/** Named evidence chip. The muted variant carries the "+N" overflow. */
export function SugReasonChip({
  children,
  muted = false,
  title,
}: {
  children: React.ReactNode
  muted?: boolean
  title?: string
}) {
  return (
    <span
      title={title}
      style={{
        padding: '2.5px 7px',
        borderRadius: 6,
        background: muted ? '#fff' : '#FAF8FF',
        border: `1px solid ${muted ? '#E7E8EE' : '#EDE4FF'}`,
        fontFamily: inter,
        fontSize: 11,
        color: muted ? '#8B8F9E' : '#4B2BB0',
        whiteSpace: 'nowrap',
        maxWidth: '100%',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        display: 'inline-block',
      }}
    >
      {children}
    </span>
  )
}

export function SugReasons({ reasons, note }: { reasons: string[]; note?: string | null }) {
  const shown = reasons.slice(0, 3)
  const overflow = reasons.length - shown.length
  return (
    <div style={{ minWidth: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, minWidth: 0, maxWidth: '100%' }}>
        {shown.map((r) => (
          <SugReasonChip key={r} title={r}>
            {r}
          </SugReasonChip>
        ))}
        {overflow > 0 && <SugReasonChip muted>+{overflow}</SugReasonChip>}
      </div>
      {note && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            marginTop: 4,
            fontFamily: inter,
            fontSize: 10.5,
            color: '#8B8F9E',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          <StickyNote size={10} strokeWidth={2} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{note}</span>
        </div>
      )}
    </div>
  )
}

/** Score over a 44×3 bar, both in the same tier colour. */
export function SugMatchCell({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div style={{ textAlign: 'right', fontFamily: poppins, fontSize: 14.5, color: '#C2C6D2' }}>—</div>
    )
  }
  const color = matchColor(score)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
      <span
        style={{
          fontFamily: poppins,
          fontSize: 14.5,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          lineHeight: 1,
          color,
        }}
      >
        {Math.round(score)}
      </span>
      <span style={{ width: 44, height: 3, borderRadius: 999, background: '#F1F0EC', overflow: 'hidden' }}>
        <span
          style={{
            display: 'block',
            height: '100%',
            width: `${Math.min(Math.max(score, 0), 100)}%`,
            borderRadius: 999,
            background: color,
          }}
        />
      </span>
    </div>
  )
}

export function SugLocationCell({ location, fits }: { location: string | null; fits: boolean | null }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div
        style={{
          fontFamily: inter,
          fontSize: 12,
          color: '#1F2230',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {location || '—'}
      </div>
      {fits !== null && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 3,
            marginTop: 2,
            fontFamily: inter,
            fontSize: 10.5,
            color: fits ? '#12B886' : '#F59E0B',
          }}
        >
          {fits ? <Check size={10} strokeWidth={2.4} /> : <AlertTriangle size={10} strokeWidth={2.2} />}
          <span>{fits ? 'Fits job' : 'Check location'}</span>
        </div>
      )}
    </div>
  )
}

const STATUS_META: Record<
  SuggestedStatus['kind'],
  { Icon: LucideIcon; color: string; label: string }
> = {
  free: { Icon: CircleDashed, color: '#8B8F9E', label: 'Not in pipeline' },
  pipeline: { Icon: GitBranch, color: '#6F3FF5', label: 'In another pipeline' },
  contacted: { Icon: Send, color: '#0B7285', label: 'Contacted' },
  rejected: { Icon: CircleSlash, color: '#C2410C', label: 'Rejected before' },
}

export function SugStatusCell({ status }: { status: SuggestedStatus }) {
  const meta = STATUS_META[status.kind]
  const { Icon } = meta
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, color: meta.color }}>
        <Icon size={12} strokeWidth={2} />
        <span
          style={{
            fontFamily: inter,
            fontSize: 11.5,
            fontWeight: status.kind === 'free' ? 400 : 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {meta.label}
        </span>
      </div>
      {status.note && (
        <div
          style={{
            marginTop: 2,
            fontFamily: inter,
            fontSize: 10.5,
            color: '#8B8F9E',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {status.note}
        </div>
      )}
    </div>
  )
}

/** 14×14 selection box. */
export function SugCheckbox({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
      style={{
        width: 14,
        height: 14,
        borderRadius: 4,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: checked ? '#0d0d09' : 'transparent',
        border: checked ? '1.5px solid #0d0d09' : '1.5px solid #C2C6D2',
        cursor: 'pointer',
        padding: 0,
      }}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/30"
    >
      {checked && <Check size={9} strokeWidth={3} color="#fffcf9" />}
    </button>
  )
}

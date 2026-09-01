/**
 * Answer rendering for the public (client-facing) reference report.
 *
 * Same visual grammar as the internal renderer, one step larger — this is read
 * once, on a laptop, by a hiring manager who will not lean in. Nothing here
 * knows about Gio's summary, flags, internal questions, the candidate's
 * self-assessment or hold notes: those never reach this payload.
 *
 * Every chip grows with its text (padding + line-height, never a fixed
 * height), because template- and referee-authored strings are full sentences.
 */
import { Calendar, Check, CircleAlert, X } from 'lucide-react'

const INK = '#1F2230'
const MUTED = '#8B8F9E'

export interface ReportQuestion {
  id: string
  label: string
  type: string
  options?: string[]
  unit?: string
}

export interface ReportAnswerValue {
  id: string
  label: string
  type: string
  value: unknown
}

/* ------------------------------------------------------------------ helpers */

export function scoreTone(value: number, scale = 10): string {
  const pct = (value / scale) * 100
  if (pct >= 80) return '#0B7A57'
  if (pct >= 60) return '#B45309'
  return '#991B1B'
}

export function isEmptyValue(v: unknown): boolean {
  if (v === null || v === undefined || v === '') return true
  if (Array.isArray(v)) return v.length === 0
  if (typeof v === 'object') {
    return Object.values(v as Record<string, unknown>).every((x) => x === null || x === undefined || x === '')
  }
  return false
}

export function numeric(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN
  return Number.isFinite(n) ? n : null
}

export interface EmploymentClaim {
  title: string
  from: string
  to: string
}

/** The referee's own employment answer — capture only, never a verdict. */
export function employmentClaim(value: unknown): EmploymentClaim | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const v = value as Record<string, unknown>
  const title = String(v.title ?? '')
  const from = String((v.from ?? v.start) ?? '')
  const to = String((v.to ?? v.end) ?? '')
  if (!title && !from && !to) return null
  return { title, from, to }
}

const REHIRE_TONES: Record<string, { bg: string; fg: string; icon: 'check' | 'alert' | 'x' }> = {
  'yes, without hesitation': { bg: '#D1FAE5', fg: '#065F46', icon: 'check' },
  'yes, with reservations': { bg: '#FEF3C7', fg: '#92400E', icon: 'alert' },
  no: { bg: '#FEE2E2', fg: '#991B1B', icon: 'x' },
}

function rehireTone(raw: string) {
  const key = raw.trim().toLowerCase()
  if (REHIRE_TONES[key]) return REHIRE_TONES[key]
  if (key.startsWith('no')) return REHIRE_TONES.no
  if (key.includes('reservation')) return REHIRE_TONES['yes, with reservations']
  return REHIRE_TONES['yes, without hesitation']
}

/* -------------------------------------------------------------- primitives */

export function RehirePill({ value }: { value: string }) {
  const tone = rehireTone(value)
  const Icon = tone.icon === 'check' ? Check : tone.icon === 'alert' ? CircleAlert : X
  return (
    <span
      className="inline-flex items-center font-inter"
      style={{
        gap: 5,
        padding: '3px 9px',
        borderRadius: 999,
        background: tone.bg,
        color: tone.fg,
        fontSize: 11.5,
        fontWeight: 500,
        lineHeight: 1.45,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon size={12} strokeWidth={2.4} style={{ flexShrink: 0 }} />
      {value}
    </span>
  )
}

export function Pips({ value }: { value: number }) {
  const filled = Math.round(value)
  return (
    <span className="inline-flex items-center" style={{ gap: 8, flexShrink: 0 }}>
      <span className="inline-flex" style={{ gap: 3 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            style={{
              width: 9,
              height: 9,
              borderRadius: 999,
              background: i < filled ? '#6F3FF5' : '#E5E1F5',
            }}
          />
        ))}
      </span>
      <span className="inline-flex items-baseline" style={{ gap: 2 }}>
        <span
          className="font-poppins tabular-nums"
          style={{ fontSize: 12.5, fontWeight: 600, color: INK }}
        >
          {Number.isInteger(value) ? value : value.toFixed(1)}
        </span>
        <span className="font-inter" style={{ fontSize: 10.5, color: MUTED }}>
          /5
        </span>
      </span>
    </span>
  )
}

export function ScoreNumeral({ value, size = 22 }: { value: number; size?: number }) {
  const tone = scoreTone(value)
  return (
    <span className="inline-flex items-baseline" style={{ gap: 3 }}>
      <span
        className="font-poppins tabular-nums"
        style={{ fontSize: size, fontWeight: 600, letterSpacing: '-0.04em', color: tone, lineHeight: 1 }}
      >
        {Number.isInteger(value) ? value : value.toFixed(1)}
      </span>
      <span className="font-inter" style={{ fontSize: 11, color: MUTED }}>
        /10
      </span>
    </span>
  )
}

function Chip({
  children,
  lilac,
}: {
  children: React.ReactNode
  lilac?: boolean
}) {
  return (
    <span
      className="inline-flex font-inter"
      style={{
        padding: '3px 10px',
        borderRadius: 999,
        lineHeight: 1.45,
        fontSize: 12,
        background: lilac ? '#EDE4FF' : '#F4F3EF',
        border: `1px solid ${lilac ? '#D7C5FB' : '#E7E8EE'}`,
        color: lilac ? '#5B21B6' : INK,
      }}
    >
      {children}
    </span>
  )
}

function NotAnswered() {
  return (
    <span className="font-inter" style={{ fontSize: 12.5, color: MUTED }}>
      Not answered
    </span>
  )
}

/* ---------------------------------------------------------------- <Answer> */

export function ReportAnswer({ type, value, unit }: { type: string; value: unknown; unit?: string }) {
  if (isEmptyValue(value) && type !== 'yes_no') return <NotAnswered />

  switch (type) {
    case 'rating_1_5': {
      const n = numeric(value)
      return n === null ? <NotAnswered /> : <Pips value={n} />
    }
    case 'recommendation_score': {
      const n = numeric(value)
      return n === null ? <NotAnswered /> : <ScoreNumeral value={n} />
    }
    case 'would_rehire':
      return <RehirePill value={String(value)} />
    case 'single_select':
      return <Chip lilac>{String(value)}</Chip>
    case 'multi_select': {
      const list = Array.isArray(value) ? value : [value]
      return (
        <span className="flex" style={{ flexWrap: 'wrap', gap: 5 }}>
          {list.map((v, i) => (
            <Chip key={i}>{String(v)}</Chip>
          ))}
        </span>
      )
    }
    case 'number': {
      const n = numeric(value)
      return (
        <span className="inline-flex items-baseline" style={{ gap: 5 }}>
          <span className="font-poppins tabular-nums" style={{ fontSize: 15, fontWeight: 600, color: INK }}>
            {n ?? String(value)}
          </span>
          {unit && (
            <span className="font-inter" style={{ fontSize: 11.5, color: MUTED }}>
              {unit}
            </span>
          )}
        </span>
      )
    }
    case 'date':
    case 'date_range': {
      const text = Array.isArray(value)
        ? value.filter(Boolean).join(' – ')
        : typeof value === 'object'
          ? [
              (value as Record<string, string>).from ?? (value as Record<string, string>).start,
              (value as Record<string, string>).to ?? (value as Record<string, string>).end,
            ]
              .filter(Boolean)
              .join(' – ')
          : String(value)
      return (
        <span className="inline-flex items-center" style={{ gap: 6 }}>
          <Calendar size={13} color={MUTED} style={{ flexShrink: 0 }} />
          <span className="font-inter" style={{ fontSize: 12.5, fontWeight: 500, color: INK }}>
            {text}
          </span>
        </span>
      )
    }
    case 'yes_no': {
      const raw = String(value ?? '').trim().toLowerCase()
      const concern = raw === 'yes' || raw === 'true'
      if (raw === '' ) {
        // Nothing captured at all still reads as "none raised" is wrong — be honest.
        return <NotAnswered />
      }
      return (
        <span
          className="inline-flex items-center font-inter"
          style={{
            gap: 5,
            padding: '3px 10px',
            borderRadius: 999,
            lineHeight: 1.45,
            fontSize: 11.5,
            fontWeight: 500,
            background: concern ? '#FFEDD5' : '#D1FAE5',
            color: concern ? '#9A3412' : '#065F46',
          }}
        >
          {concern ? (
            <CircleAlert size={12} strokeWidth={2.4} style={{ flexShrink: 0 }} />
          ) : (
            <Check size={12} strokeWidth={2.4} style={{ flexShrink: 0 }} />
          )}
          {concern ? 'Yes' : 'None raised'}
        </span>
      )
    }
    case 'employment_verification': {
      const claim = employmentClaim(value)
      if (!claim) return <NotAnswered />
      return (
        <span className="font-inter" style={{ fontSize: 12.5, fontWeight: 500, color: INK }}>
          {[claim.title, [claim.from, claim.to].filter(Boolean).join(' – ')].filter(Boolean).join(' · ')}
        </span>
      )
    }
    default:
      return (
        <span className="font-inter" style={{ fontSize: 12.5, fontWeight: 500, color: INK }}>
          {String(value)}
        </span>
      )
  }
}

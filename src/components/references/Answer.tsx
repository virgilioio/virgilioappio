import { Calendar, CalendarRange, Check, CircleAlert, Scale, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import type { ResolvedAnswer } from '@/lib/references/answers'
import type { RefQuestion } from '@/lib/references/templateModel'

const INK = '#1F2230'
const MUTED = '#8B8F9E'

function Skipped() {
  return (
    <span className="font-inter" style={{ fontSize: 12, color: MUTED }}>
      Skipped
    </span>
  )
}

/* ------------------------------------------------ employment verification */

/** Capture only — two tiles, no verdict, no match indicator. Ever. */
function EmploymentVerification({ a }: { a: ResolvedAnswer }) {
  const dates = [a.from, a.to].filter(Boolean).join(' – ')
  const tiles = [
    { label: 'Title given', value: a.title },
    { label: 'Dates given', value: dates },
  ]
  return (
    <div className="grid" style={{ gridTemplateColumns: '1fr 1fr', gap: 8 }}>
      {tiles.map((t) => (
        <div key={t.label} style={{ background: '#F1F0EC', borderRadius: 9, padding: '9px 11px' }}>
          <p
            className="font-inter uppercase"
            style={{ fontSize: 9.5, fontWeight: 600, color: MUTED, letterSpacing: '0.06em' }}
          >
            {t.label}
          </p>
          <p
            className="font-inter"
            style={{ fontSize: 12.5, fontWeight: 500, color: INK, marginTop: 3 }}
          >
            {t.value || '—'}
          </p>
        </div>
      ))}
    </div>
  )
}

/* -------------------------------------------------------------- rating 1–5 */

function ratingTone(v: number) {
  if (v >= 4) return '#12B886'
  if (v === 3) return '#F59E0B'
  return '#FA5252'
}

function Rating({
  value,
  candidateSelf,
  showChip,
}: {
  value: number
  candidateSelf: number | null
  showChip: boolean
}) {
  const tone = ratingTone(value)
  const gap = candidateSelf !== null ? candidateSelf - value : null
  const amber = gap !== null && gap >= 2

  return (
    <span
      className="inline-flex items-center"
      style={{ gap: 12, flexWrap: 'wrap' }}
    >
      <span className="inline-flex" style={{ gap: 3 }}>
        {[0, 1, 2, 3, 4].map((i) => (
          <span
            key={i}
            style={{
              width: 18,
              height: 6,
              borderRadius: 999,
              background: i < value ? tone : '#EDECE8',
            }}
          />
        ))}
      </span>

      <span className="inline-flex items-baseline" style={{ gap: 5 }}>
        <span
          className="font-poppins tabular-nums"
          style={{ fontSize: 13, fontWeight: 600, letterSpacing: '-0.02em', color: tone }}
        >
          {value}
        </span>
        <span className="font-inter" style={{ fontSize: 10.5, color: MUTED }}>
          of 5
        </span>
      </span>

      {showChip && candidateSelf !== null && (
        <span
          className="inline-flex items-center font-inter"
          style={{
            gap: 5,
            height: 20,
            padding: '0 8px',
            borderRadius: 999,
            fontSize: 10.5,
            fontWeight: 500,
            background: amber ? '#FFEDD5' : '#EDE4FF',
            color: amber ? '#9A3412' : '#5B21B6',
          }}
        >
          <Scale size={10} strokeWidth={2.2} />
          Candidate said {candidateSelf}
        </span>
      )}
    </span>
  )
}

/* ------------------------------------------------- recommendation score */

function scoreTone(v: number) {
  if (v >= 8) return '#0B7A57'
  if (v >= 6) return '#B45309'
  return '#991B1B'
}

function RecommendationScore({ value }: { value: number }) {
  const tone = scoreTone(value)
  return (
    <span className="inline-flex items-center" style={{ gap: 10 }}>
      <span className="inline-flex items-baseline" style={{ gap: 2 }}>
        <span
          className="font-poppins tabular-nums"
          style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.04em', color: tone }}
        >
          {value}
        </span>
        <span className="font-inter" style={{ fontSize: 11, color: MUTED }}>
          /10
        </span>
      </span>
      <span
        style={{
          position: 'relative',
          width: 108,
          height: 6,
          borderRadius: 999,
          background: '#EDECE8',
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            position: 'absolute',
            inset: 0,
            width: `${Math.max(0, Math.min(100, value * 10))}%`,
            borderRadius: 999,
            background: tone,
          }}
        />
      </span>
    </span>
  )
}

/* --------------------------------------------------------------- pills etc */

function Pill({ label, purple = false }: { label: string; purple?: boolean }) {
  return (
    <span
      className="inline-flex items-center font-inter"
      style={{
        height: 22,
        padding: '0 9px',
        borderRadius: 999,
        fontSize: 11.5,
        fontWeight: 500,
        background: purple ? '#EDE4FF' : '#F1F0EC',
        color: purple ? '#5B21B6' : '#5A6072',
      }}
    >
      {label}
    </span>
  )
}

function rehireMeta(raw: string) {
  const v = raw.toLowerCase()
  if (v.startsWith('no')) return { tone: 'red' as const, icon: X }
  if (v.includes('reservation')) return { tone: 'yellow' as const, icon: CircleAlert }
  return { tone: 'green' as const, icon: Check }
}

function isYes(value: unknown) {
  if (value === true) return true
  if (typeof value === 'string') return value.trim().toLowerCase() === 'yes'
  return false
}

function DateValue({
  text,
  range,
  duration,
}: {
  text: string
  range?: boolean
  duration?: string
}) {
  const Icon = range ? CalendarRange : Calendar
  return (
    <span
      className="inline-flex items-center font-inter"
      style={{ gap: 7, fontSize: 12.5, fontWeight: 500, color: INK }}
    >
      <Icon size={13} color={MUTED} />
      {text}
      {duration && (
        <span style={{ fontSize: 11, color: MUTED, fontWeight: 400 }}>· {duration}</span>
      )}
    </span>
  )
}

/**
 * One referee answer. Every type gets its own treatment — only prose is set as
 * prose, so a recruiter can scan the scores and the rehire answer.
 */
export function Answer({
  q,
  a,
  candidateSelf = null,
}: {
  q: RefQuestion
  a: ResolvedAnswer | null
  candidateSelf?: number | null
}) {
  if (!a) return <Skipped />

  if (q.type === 'employment_verification') return <EmploymentVerification a={a} />

  if (q.type === 'rating_1_5') {
    const n = Number(a.value)
    if (!Number.isFinite(n)) return <Skipped />
    return (
      <Rating
        value={n}
        candidateSelf={candidateSelf}
        showChip={q.ask_candidate_too === true}
      />
    )
  }

  if (q.type === 'recommendation_score') {
    const n = Number(a.value)
    if (!Number.isFinite(n)) return <Skipped />
    return <RecommendationScore value={n} />
  }

  if (q.type === 'would_rehire') {
    const label = String(a.value)
    const meta = rehireMeta(label)
    return (
      <Badge tone={meta.tone} size="sm" icon={meta.icon}>
        {label}
      </Badge>
    )
  }

  if (q.type === 'yes_no') {
    const yes = isYes(a.value)
    // Polarity lives on the QUESTION: "any concerns?" is bad when true.
    const bad = q.invert ? yes : !yes
    return (
      <Badge tone={bad ? 'orange' : 'green'} size="sm" icon={yes ? Check : X}>
        {yes ? 'Yes' : 'No'}
      </Badge>
    )
  }

  if (q.type === 'single_select') {
    return <Pill label={String(a.value)} purple />
  }

  if (q.type === 'multi_select') {
    const values = Array.isArray(a.value) ? (a.value as string[]) : [String(a.value)]
    return (
      <span className="flex" style={{ gap: 5, flexWrap: 'wrap' }}>
        {values.map((v) => (
          <Pill key={v} label={v} />
        ))}
      </span>
    )
  }

  if (q.type === 'date') {
    return <DateValue text={String(a.value)} duration={a.duration} />
  }

  if (q.type === 'date_range') {
    const raw = String(a.value)
    const parts = raw.includes(' to ') ? raw.split(' to ') : [raw]
    return (
      <DateValue
        range
        text={parts.filter(Boolean).join(' – ')}
        duration={a.duration}
      />
    )
  }

  if (q.type === 'number') {
    return (
      <span className="inline-flex items-baseline" style={{ gap: 5 }}>
        <span
          className="font-poppins tabular-nums"
          style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.02em', color: INK }}
        >
          {String(a.value)}
        </span>
        {a.unit && (
          <span className="font-inter" style={{ fontSize: 11.5, color: MUTED }}>
            {a.unit}
          </span>
        )}
      </span>
    )
  }

  if (q.type === 'long_text') {
    // The referee's own words — undecorated, unquoted, never truncated.
    return (
      <p className="font-inter" style={{ fontSize: 12.5, color: INK, lineHeight: 1.6 }}>
        {String(a.value)}
      </p>
    )
  }

  return (
    <span className="font-inter" style={{ fontSize: 12.5, fontWeight: 500, color: INK }}>
      {String(a.value)}
    </span>
  )
}

export default Answer

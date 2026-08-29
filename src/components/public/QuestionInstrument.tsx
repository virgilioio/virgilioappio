/**
 * The one answer instrument used by BOTH public reference flows — the referee
 * questionnaire and the candidate's self-assessment render identically, which
 * is what makes the two sides comparable later.
 */
import { PublicField, PublicInput, PublicSelect, PublicTextarea } from './PublicField'
import type { PublicQuestion } from '@/lib/references/publicApi'

const RATINGS = [1, 2, 3, 4, 5]
const REHIRE = ['Yes without hesitation', 'Yes with reservations', 'No']
const REHIRE_TONE: Record<string, { bg: string; border: string; fg: string }> = {
  'Yes without hesitation': { bg: '#E9F8F1', border: '#B7E6D2', fg: '#0E7A55' },
  'Yes with reservations': { bg: '#FEF4E6', border: '#F5D9AE', fg: '#B25309' },
  No: { bg: '#FDECEC', border: '#F3C6C2', fg: '#B32820' },
}

export interface EmploymentVerificationValue {
  title?: string
  start?: string
  end?: string
}

interface Props {
  question: PublicQuestion
  value: unknown
  onChange: (value: unknown) => void
  onBlur?: () => void
  /** Rating legend prints once — on the first rating question only. */
  showRatingLegend?: boolean
}

export function QuestionInstrument({ question, value, onChange, onBlur, showRatingLegend }: Props) {
  const q = question

  if (q.type === 'rating_1_5') {
    return (
      <div>
        <div className="flex flex-wrap" style={{ gap: 7 }}>
          {RATINGS.map((n) => {
            const sel = Number(value) === n
            return (
              <button
                key={n}
                type="button"
                aria-pressed={sel}
                onClick={() => {
                  onChange(n)
                  onBlur?.()
                }}
                className="font-poppins"
                style={{
                  width: 52,
                  height: 42,
                  borderRadius: 9,
                  border: `1px solid ${sel ? '#0d0d09' : '#E3E0D6'}`,
                  background: sel ? '#0d0d09' : '#fff',
                  color: sel ? '#fffcf9' : '#5A6072',
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {n}
              </button>
            )
          })}
        </div>
        {showRatingLegend && (
          <p className="font-inter" style={{ fontSize: 11, color: '#8B8F9E', marginTop: 7 }}>
            1 = well below expectations · 5 = exceptional
          </p>
        )}
      </div>
    )
  }

  if (q.type === 'would_rehire') {
    return (
      <div className="flex flex-col" style={{ gap: 7 }}>
        {(q.options?.length ? q.options : REHIRE).map((opt) => {
          const sel = value === opt
          const tone = REHIRE_TONE[opt] ?? { bg: '#F7F6F2', border: '#E3E0D6', fg: '#1F2230' }
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={sel}
              onClick={() => {
                onChange(opt)
                onBlur?.()
              }}
              className="font-inter text-left"
              style={{
                width: '100%',
                minHeight: 44,
                padding: '11px 13px',
                borderRadius: 10,
                border: `1px solid ${sel ? tone.border : '#EDEBE3'}`,
                background: sel ? tone.bg : '#fff',
                color: sel ? tone.fg : '#5A6072',
                fontSize: 13,
                fontWeight: sel ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {opt}
            </button>
          )
        })}
      </div>
    )
  }

  if (q.type === 'recommendation_score') {
    return (
      <div className="flex flex-wrap" style={{ gap: 6 }}>
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
          const sel = Number(value) === n
          return (
            <button
              key={n}
              type="button"
              aria-pressed={sel}
              onClick={() => {
                onChange(n)
                onBlur?.()
              }}
              className="font-poppins"
              style={{
                width: 40,
                height: 40,
                borderRadius: 9,
                border: `1px solid ${sel ? '#0d0d09' : '#E3E0D6'}`,
                background: sel ? '#0d0d09' : '#fff',
                color: sel ? '#fffcf9' : '#5A6072',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {n}
            </button>
          )
        })}
      </div>
    )
  }

  if (q.type === 'employment_verification') {
    // Always empty on load — never prefilled from our own records.
    const v = (value ?? {}) as EmploymentVerificationValue
    const set = (patch: Partial<EmploymentVerificationValue>) => onChange({ ...v, ...patch })
    return (
      <div className="grid" style={{ gap: 10, gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))' }}>
        <PublicField label="Job title they held">
          <PublicInput
            value={v.title ?? ''}
            onChange={(e) => set({ title: e.target.value })}
            onBlur={onBlur}
            placeholder=""
          />
        </PublicField>
        <PublicField label="Start (month / year)">
          <PublicMonthField
            value={v.start ?? ''}
            onChange={(val) => set({ start: val })}
            onBlur={onBlur}
            placeholder="Start month"
          />
        </PublicField>
        <PublicField label="End (month / year)">
          <PublicMonthField
            value={v.end ?? ''}
            onChange={(val) => set({ end: val })}
            onBlur={onBlur}
            placeholder="End month"
          />
        </PublicField>
      </div>
    )
  }

  if (q.type === 'yes_no') {
    return (
      <div className="flex" style={{ gap: 7 }}>
        {['Yes', 'No'].map((opt) => {
          const sel = value === opt
          return (
            <button
              key={opt}
              type="button"
              aria-pressed={sel}
              onClick={() => {
                onChange(opt)
                onBlur?.()
              }}
              className="font-poppins"
              style={{
                minWidth: 74,
                height: 42,
                borderRadius: 9,
                border: `1px solid ${sel ? '#0d0d09' : '#E3E0D6'}`,
                background: sel ? '#0d0d09' : '#fff',
                color: sel ? '#fffcf9' : '#5A6072',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {opt}
            </button>
          )
        })}
      </div>
    )
  }

  if (q.type === 'single_select') {
    return (
      <PublicSelect
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      >
        <option value="">Select…</option>
        {(q.options ?? []).map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </PublicSelect>
    )
  }

  if (q.type === 'multi_select') {
    const arr = Array.isArray(value) ? (value as string[]) : []
    return (
      <div className="flex flex-wrap" style={{ gap: 7 }}>
        {(q.options ?? []).map((o) => {
          const sel = arr.includes(o)
          return (
            <button
              key={o}
              type="button"
              aria-pressed={sel}
              onClick={() => {
                onChange(sel ? arr.filter((x) => x !== o) : [...arr, o])
                onBlur?.()
              }}
              className="font-inter"
              style={{
                minHeight: 34,
                padding: '7px 12px',
                borderRadius: 999,
                border: `1px solid ${sel ? '#D7C5FB' : '#E3E0D6'}`,
                background: sel ? '#EDE4FF' : '#fff',
                color: sel ? '#4B22B8' : '#5A6072',
                fontSize: 12.5,
                cursor: 'pointer',
              }}
            >
              {o}
            </button>
          )
        })}
      </div>
    )
  }

  if (q.type === 'short_text') {
    return (
      <PublicInput
        value={String(value ?? '')}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
      />
    )
  }

  return (
    <PublicTextarea
      value={String(value ?? '')}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
    />
  )
}

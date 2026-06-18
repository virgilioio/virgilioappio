import type { ScoreRating } from '@/hooks/useScorecards'

interface Props {
  value: ScoreRating | ''
  onChange: (value: ScoreRating | '') => void
  disabled?: boolean
}

interface PillSpec {
  value: ScoreRating
  label: string
  dot: string
}

// Verdict-distribution palette (Scorecards Summary sidebar).
const PILLS: PillSpec[] = [
  { value: 'strong_no',  label: 'Strong No',  dot: '#EF4444' },
  { value: 'lean_no',    label: 'Lean No',    dot: '#F97316' },
  { value: 'lean_yes',   label: 'Lean Yes',   dot: '#F59E0B' },
  { value: 'yes',        label: 'Yes',        dot: '#12B886' },
  { value: 'strong_yes', label: 'Strong Yes', dot: '#12B886' },
]

/**
 * Score (1–5) pills used inside per-question scoring in the Scorecard sheet.
 * Single-line, click-to-toggle, colored dot is the sole verdict signal.
 */
export function ScoreFivePills({ value, onChange, disabled }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Score 1 to 5"
      style={{ display: 'flex', flexWrap: 'nowrap', gap: 6 }}
    >
      {PILLS.map((p) => {
        const selected = value === p.value
        const pillStyle: React.CSSProperties = {
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 7,
          height: 34,
          padding: '0 13px',
          borderRadius: 999,
          whiteSpace: 'nowrap',
          cursor: disabled ? 'not-allowed' : 'pointer',
          flex: '0 1 auto',
          minWidth: 0,
          background: '#fff',
          transition: 'border-color 140ms ease, box-shadow 140ms ease',
          border: selected ? '1px solid #0d0d09' : '1px solid #E0DDD3',
          boxShadow: selected ? '0 1px 2px rgba(13,13,9,0.08)' : 'none',
        }
        const labelStyle: React.CSSProperties = {
          fontFamily: 'Inter, sans-serif',
          fontSize: 12.5,
          color: selected ? '#1F2230' : '#5A6072',
          fontWeight: selected ? 600 : 500,
          whiteSpace: 'nowrap',
        }
        return (
          <button
            key={p.value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={p.label}
            disabled={disabled}
            onClick={() => onChange(selected ? '' : p.value)}
            style={pillStyle}
            className="focus:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/30"
          >
            <span
              aria-hidden="true"
              style={{
                width: 9,
                height: 9,
                borderRadius: 999,
                background: p.dot,
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <span style={labelStyle}>{p.label}</span>
          </button>
        )
      })}
    </div>
  )
}

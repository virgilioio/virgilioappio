import type { ScoreRating } from '@/hooks/useScorecards'
import { RATING_VALUES, RATING_META } from '@/lib/scorecardRatings'

interface Props {
  value: ScoreRating
  onChange: (value: ScoreRating) => void
  disabled?: boolean
  /** Compact mode hides labels (icon-only) — used for per-question scoring inside scorecards. */
  compact?: boolean
}

/**
 * Overall rating — five outline pills (Strong no · Lean no · Lean yes · Yes · Strong yes).
 * Only the selected pill fills with its spec color; the others fade to opacity 0.65.
 */
export function OverallRatingPills({ value, onChange, disabled, compact }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Rating"
      className={compact ? 'grid grid-cols-5 gap-1.5' : 'grid grid-cols-5 gap-2'}
    >
      {RATING_VALUES.map((v) => {
        const meta = RATING_META[v]
        const Icon = meta.icon
        const active = value === v
        const dim = !!value && !active

        const style: React.CSSProperties = active
          ? { backgroundColor: meta.bg, borderColor: meta.bg, color: meta.text }
          : { backgroundColor: '#FFFFFF', borderColor: '#E0DDD3', color: '#5A6072' }

        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={meta.label}
            title={meta.label}
            disabled={disabled}
            onClick={() => onChange(v)}
            className={`
              inline-flex items-center justify-center gap-1.5
              ${compact ? 'h-9 rounded-[8px] text-[12px] px-1' : 'h-[46px] rounded-[10px] text-[12.5px] px-1.5'}
              border font-poppins font-medium
              transition-all duration-200
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6F3FF5]/30
              ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
              ${dim ? 'opacity-65' : 'opacity-100'}
            `}
            style={style}
          >
            <Icon
              className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'}
              style={{ color: active ? meta.text : '#8B8F9E' }}
            />
            {!compact && <span className="truncate">{meta.label}</span>}
          </button>
        )
      })}
    </div>
  )
}

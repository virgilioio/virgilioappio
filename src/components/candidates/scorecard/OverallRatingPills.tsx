import { ThumbsDown, XCircle, ThumbsUp, Star } from 'lucide-react'
import type { ScoreRating } from '@/hooks/useScorecards'

interface Props {
  value: ScoreRating
  onChange: (value: ScoreRating) => void
  disabled?: boolean
}

type PillSpec = {
  value: ScoreRating
  label: string
  Icon: typeof ThumbsDown
  /** Spec fill colors — brand accents for the rating system, intentionally hex (not themable). */
  fillBg: string
  fillText: string
}

const PILLS: PillSpec[] = [
  { value: 'definitely_no', label: 'Definitely No', Icon: ThumbsDown, fillBg: '#C9554C', fillText: '#FFFFFF' },
  { value: 'no',            label: 'No',            Icon: XCircle,    fillBg: '#E7ABA4', fillText: '#7A2E27' },
  { value: 'yes',           label: 'Yes',           Icon: ThumbsUp,   fillBg: '#C8B9F0', fillText: '#3B2A6B' },
  { value: 'strong_yes',    label: 'Strong Yes',    Icon: Star,       fillBg: '#6F3FF5', fillText: '#FFFFFF' },
]

/**
 * Overall rating — four outline pills. Only the selected pill fills with its spec color;
 * the others fade to opacity 0.65. Click the selected pill again to clear.
 */
export function OverallRatingPills({ value, onChange, disabled }: Props) {
  const hasSelection = !!value
  return (
    <div role="radiogroup" aria-label="Overall rating" className="grid grid-cols-4 gap-3">
      {PILLS.map(({ value: v, label, Icon, fillBg, fillText }) => {
        const active = value === v
        const dim = hasSelection && !active

        const style: React.CSSProperties = active
          ? { backgroundColor: fillBg, borderColor: fillBg, color: fillText }
          : { backgroundColor: '#FFFFFF', borderColor: '#E0DDD3', color: '#5A6072' }

        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={disabled}
            onClick={() => onChange(active ? ('' as unknown as ScoreRating) : v)}
            className={`
              inline-flex items-center justify-center gap-1.5
              h-[46px] rounded-[10px] border
              font-poppins font-medium text-[13px]
              transition-all duration-200
              focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6F3FF5]/30
              ${disabled ? 'cursor-not-allowed' : 'cursor-pointer'}
              ${dim ? 'opacity-65' : 'opacity-100'}
            `}
            style={style}
          >
            <Icon
              className="h-4 w-4"
              style={{ color: active ? fillText : '#8B8F9E' }}
            />
            <span>{label}</span>
          </button>
        )
      })}
    </div>
  )
}

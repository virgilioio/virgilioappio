import { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ScoreFieldConfig {
  /** Highest selectable value. Defaults to 5. */
  max?: 5 | 10
  /** Optional caption under the first star. */
  min_label?: string | null
  /** Optional caption under the last star. */
  max_label?: string | null
}

interface StarScoreInputProps {
  value?: number | string | null
  onChange: (value: number | null) => void
  config?: ScoreFieldConfig | null
  disabled?: boolean
  /** Accessible name, usually the question label. */
  ariaLabel?: string
}

/**
 * Star rating input (1..max) used by the "Score" question type on
 * application/offer forms. Presentational and fully controlled.
 */
export function StarScoreInput({ value, onChange, config, disabled, ariaLabel }: StarScoreInputProps) {
  const max = config?.max === 10 ? 10 : 5
  const current = Number(value) > 0 ? Math.min(Number(value), max) : 0
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover ?? current

  const set = (next: number) => {
    if (disabled) return
    onChange(next === current ? null : next)
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      e.preventDefault()
      onChange(Math.min(current + 1, max) || 1)
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      e.preventDefault()
      const next = current - 1
      onChange(next >= 1 ? next : null)
    } else if (e.key === 'Home') {
      e.preventDefault()
      onChange(1)
    } else if (e.key === 'End') {
      e.preventDefault()
      onChange(max)
    }
  }

  return (
    <div className="space-y-1.5">
      <div
        role="slider"
        tabIndex={disabled ? -1 : 0}
        aria-label={ariaLabel}
        aria-valuemin={1}
        aria-valuemax={max}
        aria-valuenow={current || undefined}
        aria-valuetext={current ? `${current} of ${max}` : 'Not rated'}
        aria-disabled={disabled || undefined}
        onKeyDown={onKeyDown}
        onMouseLeave={() => setHover(null)}
        className={cn(
          'inline-flex items-center gap-1 rounded-lg outline-none',
          'focus-visible:ring-2 focus-visible:ring-virgilio-purple/30',
          disabled && 'opacity-60'
        )}
      >
        {Array.from({ length: max }, (_, i) => i + 1).map((n) => {
          const active = n <= shown
          return (
            <button
              key={n}
              type="button"
              tabIndex={-1}
              disabled={disabled}
              aria-label={`${n} of ${max}`}
              onMouseEnter={() => setHover(n)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(null)}
              onClick={() => set(n)}
              className={cn(
                'rounded-md p-0.5 transition-colors',
                !disabled && 'hover:bg-[#F1F0EC] cursor-pointer',
                disabled && 'cursor-not-allowed'
              )}
            >
              <Star
                className={cn(
                  'h-6 w-6 transition-colors',
                  active ? 'text-[#F5C16C]' : 'text-[#D8D5CC]'
                )}
                fill={active ? '#F5C16C' : 'none'}
                strokeWidth={1.75}
              />
            </button>
          )
        })}
      </div>

      <div className="flex items-center gap-2">
        {(config?.min_label || config?.max_label) && (
          <span
            className="text-[11.5px] text-text-tertiary"
            style={{ minWidth: max * 28 }}
          >
            <span>{config?.min_label || ''}</span>
            {config?.max_label && (
              <span className="float-right">{config.max_label}</span>
            )}
          </span>
        )}
        {!config?.min_label && !config?.max_label && (
          <span className="text-[11.5px] text-text-tertiary">
            {current ? `${current} of ${max}` : `Pick a value from 1 to ${max}`}
          </span>
        )}
      </div>
    </div>
  )
}

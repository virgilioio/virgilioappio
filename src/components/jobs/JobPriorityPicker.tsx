import { useRef } from 'react'
import {
  JOB_PRIORITIES,
  DEFAULT_JOB_PRIORITY,
  type JobPriority,
} from '@/lib/job-priority'

interface JobPriorityPickerProps {
  value?: JobPriority | null
  onChange: (value: JobPriority) => void
  disabled?: boolean
}

/**
 * 4-across segmented row of buttons. Not a <select>.
 */
export function JobPriorityPicker({ value, onChange, disabled }: JobPriorityPickerProps) {
  const active = value ?? DEFAULT_JOB_PRIORITY
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const move = (from: number, delta: number) => {
    const next = (from + delta + JOB_PRIORITIES.length) % JOB_PRIORITIES.length
    onChange(JOB_PRIORITIES[next].id)
    refs.current[next]?.focus()
  }

  return (
    <div role="group" aria-label="Priority" style={{ display: 'flex', gap: 6 }}>
      {JOB_PRIORITIES.map((p, i) => {
        const selected = p.id === active
        return (
          <button
            key={p.id}
            ref={(el) => { refs.current[i] = el }}
            type="button"
            disabled={disabled}
            aria-pressed={selected}
            onClick={() => onChange(p.id)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(i, 1) }
              if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(i, -1) }
            }}
            className="inline-flex items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/30 disabled:opacity-60"
            style={{
              flex: 1,
              height: 33,
              padding: '7px 8px',
              borderRadius: 8,
              gap: 6,
              fontFamily: 'Poppins, sans-serif',
              fontSize: 12,
              fontWeight: selected ? 600 : 500,
              color: selected ? p.ink : '#5A6072',
              background: selected ? p.tint : '#FFFFFF',
              border: `1px solid ${selected ? p.dot : '#E0DDD3'}`,
              boxShadow: selected ? `inset 0 0 0 1px ${p.dot}` : undefined,
            }}
          >
            <span
              aria-hidden
              style={{ width: 7, height: 7, borderRadius: 999, background: p.dot, flex: '0 0 7px' }}
            />
            <span className="truncate">{p.label}</span>
          </button>
        )
      })}
    </div>
  )
}

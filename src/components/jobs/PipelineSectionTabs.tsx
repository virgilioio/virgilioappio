import * as React from 'react'
import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CREAM, HAIRLINE, INK, MUTED, PASTELS, SAND, SURFACE_HOVER, TERTIARY } from '@/lib/pastels'

export type PipelineSection = 'suggested' | 'application' | 'recruiting' | 'offers' | 'hired' | 'rejected'

interface SectionDef {
  value: PipelineSection
  label: string
  tone: keyof typeof PASTELS
}

/**
 * Six sections, always six equal columns. This row is a segmented control —
 * a state switch, not navigation, which is why it is filled and boxed while
 * row 1 above it is a bare underline.
 */
const SECTIONS: SectionDef[] = [
  { value: 'suggested', label: 'Suggested', tone: 'lilac' },
  { value: 'application', label: 'Application review', tone: 'purple' },
  { value: 'recruiting', label: 'Recruiting process', tone: 'yellow' },
  { value: 'offers', label: 'Job offers', tone: 'blue' },
  { value: 'hired', label: 'Hired', tone: 'green' },
  { value: 'rejected', label: 'Rejected', tone: 'neutral' },
]

export interface PipelineSectionTabsProps {
  value: PipelineSection
  onChange: (v: PipelineSection) => void
  counts: Record<PipelineSection, number | undefined>
  className?: string
}

export function PipelineSectionTabs({ value, onChange, counts, className }: PipelineSectionTabsProps) {
  const refs = React.useRef<(HTMLButtonElement | null)[]>([])

  // Roving focus: only the selected tab is tabbable, arrows move and select.
  const onKeyDown = (e: React.KeyboardEvent, index: number) => {
    let next: number | null = null
    if (e.key === 'ArrowRight') next = (index + 1) % SECTIONS.length
    if (e.key === 'ArrowLeft') next = (index - 1 + SECTIONS.length) % SECTIONS.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = SECTIONS.length - 1
    if (next === null) return
    e.preventDefault()
    onChange(SECTIONS[next].value)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="tablist"
      aria-label="Pipeline section"
      className={cn('grid', className)}
      style={{
        gridTemplateColumns: `repeat(${SECTIONS.length}, minmax(0, 1fr))`,
        gap: 6,
        padding: 4,
        borderRadius: 12,
        background: SURFACE_HOVER,
        border: `1px solid ${HAIRLINE}`,
      }}
    >
      {SECTIONS.map((s, i) => {
        const isActive = value === s.value
        const count = counts[s.value]
        const pastel = PASTELS[s.tone]

        return (
          <button
            key={s.value}
            ref={(el) => {
              refs.current[i] = el
            }}
            role="tab"
            type="button"
            aria-selected={isActive}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onChange(s.value)}
            onKeyDown={(e) => onKeyDown(e, i)}
            className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/30"
            style={{
              height: 44,
              minWidth: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '0 10px',
              borderRadius: 9,
              border: '1px solid',
              borderColor: isActive ? 'transparent' : 'transparent',
              background: isActive ? pastel.bg : 'transparent',
              color: isActive ? pastel.fg : MUTED,
              fontFamily: "'Poppins', system-ui, sans-serif",
              fontSize: 12.5,
              fontWeight: isActive ? 600 : 500,
              letterSpacing: '-0.01em',
              cursor: 'pointer',
              transition: 'background 120ms ease, color 120ms ease',
            }}
            onMouseEnter={(e) => {
              if (!isActive) e.currentTarget.style.background = '#fff'
            }}
            onMouseLeave={(e) => {
              if (!isActive) e.currentTarget.style.background = 'transparent'
            }}
          >
            {s.value === 'suggested' && <Sparkles size={12} strokeWidth={2} style={{ flexShrink: 0 }} />}
            <span
              style={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                minWidth: 0,
              }}
            >
              {s.label}
            </span>
            <span
              style={{
                flexShrink: 0,
                minWidth: 18,
                height: 16,
                lineHeight: '16px',
                padding: '0 5px',
                borderRadius: 999,
                textAlign: 'center',
                fontFamily: "'Poppins', system-ui, sans-serif",
                fontSize: 10.5,
                fontWeight: 600,
                fontVariantNumeric: 'tabular-nums',
                background: isActive ? INK : SAND,
                color: isActive ? CREAM : TERTIARY,
              }}
            >
              {typeof count === 'number' ? count : '—'}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export default PipelineSectionTabs

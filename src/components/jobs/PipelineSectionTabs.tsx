import { Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

export type PipelineSection = 'suggested' | 'application' | 'recruiting' | 'offers' | 'hired' | 'rejected'

interface SectionDef {
  value: PipelineSection
  label: string
  /** Active background tone */
  active: string
  /** Count chip background when inactive */
  chipInactive: string
  /** Count chip background when active */
  chipActive: string
  icon?: React.ComponentType<{ className?: string }>
}

const SECTIONS: SectionDef[] = [
  {
    value: 'suggested',
    label: 'Suggested',
    active: 'bg-pastel-purple/40 text-text-primary',
    chipInactive: 'bg-muted text-text-secondary',
    chipActive: 'bg-virgilio-purple text-white',
    icon: Sparkles,
  },
  {
    value: 'application',
    label: 'Application review',
    active: 'bg-pastel-purple text-text-primary',
    chipInactive: 'bg-muted text-text-secondary',
    chipActive: 'bg-citron-noir text-cream',
  },
  {
    value: 'recruiting',
    label: 'Recruiting process',
    active: 'bg-pastel-yellow text-text-primary',
    chipInactive: 'bg-muted text-text-secondary',
    chipActive: 'bg-citron-noir text-cream',
  },
  {
    value: 'offers',
    label: 'Job offers',
    active: 'bg-pastel-blue text-text-primary',
    chipInactive: 'bg-muted text-text-secondary',
    chipActive: 'bg-citron-noir text-cream',
  },
  {
    value: 'hired',
    label: 'Hired',
    active: 'bg-success/20 text-text-primary',
    chipInactive: 'bg-muted text-text-secondary',
    chipActive: 'bg-success text-success-foreground',
  },
  {
    value: 'rejected',
    label: 'Rejected',
    active: 'bg-destructive/15 text-text-primary',
    chipInactive: 'bg-muted text-text-secondary',
    chipActive: 'bg-destructive text-destructive-foreground',
  },
]

export interface PipelineSectionTabsProps {
  value: PipelineSection
  onChange: (v: PipelineSection) => void
  counts: Record<PipelineSection, number | undefined>
  className?: string
}

export function PipelineSectionTabs({ value, onChange, counts, className }: PipelineSectionTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Pipeline section"
      className={cn(
        'flex w-full items-center justify-between gap-2',
        className
      )}
    >
      {SECTIONS.map((s) => {
        const Icon = s.icon
        const isActive = value === s.value
        const count = counts[s.value]
        return (
          <button
            key={s.value}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(s.value)}
            className={cn(
              'group inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 font-poppins text-[12.5px] tracking-[-0.005em] transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/30',
              isActive
                ? cn(s.active, 'font-semibold')
                : 'font-medium text-text-secondary hover:bg-[#FAFAF7] hover:text-text-primary'
            )}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            <span className="truncate">{s.label}</span>
            {typeof count === 'number' && (
              <span
                className={cn(
                  'inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1.5 text-[11px] font-semibold tabular-nums transition-colors',
                  isActive ? s.chipActive : s.chipInactive
                )}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export default PipelineSectionTabs

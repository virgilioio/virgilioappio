import { Sparkles, Circle } from 'lucide-react'
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
    <section
      className={cn(
        'bg-white border border-virgilio-border rounded-2xl shadow-sm p-5 sm:p-6',
        className
      )}
    >
      <div
        role="tablist"
        aria-label="Pipeline section"
        className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1"
      >
        {SECTIONS.map((s) => {
          const Icon = s.icon
          const isActive = value === s.value
          const count = counts[s.value]
          const countLabel =
            typeof count === 'number' ? `${count} candidate${count === 1 ? '' : 's'}` : '—'

          return (
            <button
              key={s.value}
              role="tab"
              aria-selected={isActive}
              type="button"
              onClick={() => onChange(s.value)}
              className={cn(
                'flex-1 min-w-[140px] rounded-xl px-3 py-2.5 transition-colors text-left',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/30',
                isActive
                  ? cn(s.active, 'font-semibold')
                  : 'border border-dashed border-virgilio-border text-text-tertiary bg-transparent hover:bg-[#FAFAF7] hover:text-text-primary'
              )}
            >
              <div className="flex items-center gap-1.5">
                {isActive ? (
                  <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-text-primary/10">
                    <span className="h-1.5 w-1.5 rounded-full bg-text-primary" />
                  </span>
                ) : Icon ? (
                  <Icon className="h-3.5 w-3.5 opacity-70" />
                ) : (
                  <Circle className="h-3.5 w-3.5 opacity-50" />
                )}
                <span className="font-poppins font-medium text-[12.5px] tracking-[-0.005em] truncate">
                  {s.label}
                </span>
              </div>
              <div
                className={cn(
                  'mt-1 font-poppins text-[11px] tracking-[-0.005em] truncate',
                  isActive ? 'text-text-primary/70' : 'text-text-tertiary/80'
                )}
              >
                {countLabel}
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export default PipelineSectionTabs

import { Check, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { JobStage } from '@/hooks/useJobHiringPlan'

export type PlanStageOption = { jhsId: string; stage: JobStage; position: number }

interface ProfileStageStripProps {
  stages: PlanStageOption[]
  currentStageId?: string | null
  /** Optional metadata per stage (passed-in days, current day count). */
  meta?: Record<string, { passedInDays?: number; currentDay?: number; totalDays?: number }>
}

export function ProfileStageStrip({ stages, currentStageId, meta = {} }: ProfileStageStripProps) {
  if (!stages.length) return null
  const sorted = [...stages].sort((a, b) => a.position - b.position)
  const currentIdx = currentStageId ? sorted.findIndex(s => s.jhsId === currentStageId) : -1

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1">
      {sorted.map((opt, idx) => {
        const isPast = currentIdx >= 0 && idx < currentIdx
        const isCurrent = currentIdx >= 0 && idx === currentIdx
        const m = meta[opt.jhsId] || {}

        const base = 'flex-1 min-w-[140px] rounded-xl px-3 py-2.5 transition-colors'
        const stateClass = isPast
          ? 'bg-pastel-green text-pastel-green-foreground'
          : isCurrent
          ? 'bg-citron-noir text-cream'
          : 'border border-dashed border-virgilio-border text-text-tertiary bg-transparent'

        return (
          <div key={opt.jhsId} className={cn(base, stateClass)}>
            <div className="flex items-center gap-1.5">
              {isPast ? (
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-pastel-green-foreground/15">
                  <Check className="h-2.5 w-2.5 text-pastel-green-foreground" strokeWidth={3} />
                </span>
              ) : isCurrent ? (
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-cream/15">
                  <span className="h-1.5 w-1.5 rounded-full bg-cream" />
                </span>
              ) : (
                <Circle className="h-3.5 w-3.5 opacity-50" />
              )}
              <span className="font-poppins font-medium text-[12.5px] tracking-[-0.005em] truncate">
                {opt.stage.stage_name}
              </span>
            </div>
            <div className={cn(
              'mt-1 font-poppins text-[11px] tracking-[-0.005em] truncate',
              isPast ? 'text-pastel-green-foreground/80' : isCurrent ? 'text-cream/70' : 'text-text-tertiary/80'
            )}>
              {isPast
                ? (m.passedInDays != null ? `✓ Passed in ${m.passedInDays}d` : '✓ Passed')
                : isCurrent
                ? (m.currentDay && m.totalDays
                    ? `In stage · day ${m.currentDay} of ${m.totalDays}`
                    : 'In stage')
                : 'Upcoming'}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default ProfileStageStrip

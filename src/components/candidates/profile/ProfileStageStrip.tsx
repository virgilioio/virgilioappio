import { useState } from 'react'
import { Check, Circle, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { JobStage } from '@/hooks/useJobHiringPlan'

export type PlanStageOption = { jhsId: string; stage: JobStage; position: number }

interface ProfileStageStripProps {
  stages: PlanStageOption[]
  currentStageId?: string | null
  /** Optional metadata per stage (passed-in days, current day count). */
  meta?: Record<string, { passedInDays?: number; currentDay?: number; totalDays?: number }>
  /** When provided, each non-current chip becomes clickable and triggers this. */
  onStageClick?: (jhsId: string) => void | Promise<void>
  /** Disables all interaction (e.g. rejected/hired/no association). */
  disabled?: boolean
}

export function ProfileStageStrip({ stages, currentStageId, meta = {}, onStageClick, disabled }: ProfileStageStripProps) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  if (!stages.length) return null
  const sorted = [...stages].sort((a, b) => a.position - b.position)
  const currentIdx = currentStageId ? sorted.findIndex(s => s.jhsId === currentStageId) : -1
  const interactive = !!onStageClick && !disabled

  const handleClick = async (jhsId: string) => {
    if (!onStageClick || pendingId || disabled) return
    setPendingId(jhsId)
    try {
      await onStageClick(jhsId)
    } finally {
      setPendingId(null)
    }
  }

  return (
    <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1">
      {sorted.map((opt, idx) => {
        const isPast = currentIdx >= 0 && idx < currentIdx
        const isCurrent = currentIdx >= 0 && idx === currentIdx
        const isPending = pendingId === opt.jhsId
        const m = meta[opt.jhsId] || {}
        const clickable = interactive && !isCurrent

        const base = 'flex-1 min-w-[140px] rounded-[10px] px-3 py-2.5 transition-all text-left'
        const stateClass = isPast
          ? 'bg-[#D1FAE5] text-[#065F46]'
          : isCurrent
          ? 'bg-[#0d0d09] text-[#fffcf9]'
          : 'border border-dashed border-[#D1D0CB] text-[#8B8F9E] bg-transparent'
        const interactiveClass = clickable
          ? 'cursor-pointer hover:ring-2 hover:ring-virgilio-purple/30 hover:border-virgilio-purple/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/40'
          : ''
        const pendingClass = isPending ? 'opacity-60' : ''

        const content = (
          <>
            <div className="flex items-center gap-1.5">
              {isPending ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin opacity-70" />
              ) : isPast ? (
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#12B886]">
                  <Check className="h-2.5 w-2.5 text-white" strokeWidth={3} />
                </span>
              ) : isCurrent ? (
                <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/15">
                  <span className="h-1.5 w-1.5 rounded-full bg-white" />
                </span>
              ) : (
                <Circle className="h-3.5 w-3.5 opacity-50" />
              )}
              <span className={cn(
                'font-poppins text-[11.5px] tracking-[-0.005em] truncate',
                isCurrent ? 'font-semibold' : 'font-medium'
              )}>
                {opt.stage.stage_name}
              </span>
            </div>
            <div className={cn(
              'mt-1 font-inter text-[10.5px] tracking-[-0.005em] truncate',
              isPast ? 'text-[#065F46]/80' : isCurrent ? 'text-white/70' : 'text-[#8B8F9E]/80'
            )}>
              {isPast
                ? (m.passedInDays != null ? `✓ Passed in ${m.passedInDays}d` : '✓ Passed')
                : isCurrent
                ? (m.currentDay && m.totalDays
                    ? `In stage · day ${m.currentDay} of ${m.totalDays}`
                    : m.currentDay
                    ? `In stage · day ${m.currentDay}`
                    : 'In stage')
                : 'Upcoming'}
            </div>
          </>
        )

        if (clickable) {
          return (
            <button
              type="button"
              key={opt.jhsId}
              disabled={!!pendingId}
              onClick={() => handleClick(opt.jhsId)}
              className={cn(base, stateClass, interactiveClass, pendingClass)}
              title={`Move to ${opt.stage.stage_name}`}
            >
              {content}
            </button>
          )
        }

        return (
          <div key={opt.jhsId} className={cn(base, stateClass)}>
            {content}
          </div>
        )
      })}
    </div>
  )
}

export default ProfileStageStrip

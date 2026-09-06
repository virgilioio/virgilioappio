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
    <div
      className="flex bg-white border border-[#E7E8EE] rounded-xl p-1.5 gap-1.5 mb-4"
      style={{ padding: 6, gap: 6, borderRadius: 12 }}
    >
      {sorted.map((opt, idx) => {
        const isPast = currentIdx >= 0 && idx < currentIdx
        const isCurrent = currentIdx >= 0 && idx === currentIdx
        const isPending = pendingId === opt.jhsId
        const m = meta[opt.jhsId] || {}
        const clickable = interactive && !isCurrent

        const base = 'flex-1 min-w-0 rounded-lg px-3 py-2.5 transition-all text-left flex items-center gap-2'
        const stateClass = isPast
          ? 'bg-[#D1FAE5] text-[#065F46] border border-solid border-transparent'
          : isCurrent
          ? 'bg-[#0d0d09] text-[#fffcf9] border border-solid border-transparent'
          : 'border border-dashed border-[#D1D0CB] text-[#8B8F9E] bg-white'
        const interactiveClass = clickable
          ? 'cursor-pointer hover:ring-2 hover:ring-virgilio-purple/30 hover:border-virgilio-purple/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-virgilio-purple/40'
          : ''
        const pendingClass = isPending ? 'opacity-60' : ''

        const daysText = isPast
          ? (m.passedInDays != null ? `${m.passedInDays}d` : null)
          : isCurrent
          ? (m.currentDay && m.totalDays
              ? `day ${m.currentDay} of ${m.totalDays}`
              : m.currentDay
              ? `day ${m.currentDay}`
              : null)
          : null

        const content = (
          <>
            {isPending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin opacity-70 flex-shrink-0" />
            ) : isPast ? (
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#12B886] flex-shrink-0">
                <Check className="h-[9px] w-[9px] text-white" strokeWidth={3} />
              </span>
            ) : isCurrent ? (
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white/25 flex-shrink-0" />
            ) : (
              <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border-[1.5px] border-[#C2C6D2] flex-shrink-0" />
            )}
            <span className={cn(
              'font-poppins text-[12.5px] leading-[1.2] tracking-[-0.005em] truncate',
              isCurrent ? 'font-semibold' : 'font-medium'
            )}>
              {opt.stage.stage_name}
            </span>
            {daysText && (
              <span
                className={cn(
                  'ml-auto flex-shrink-0 font-inter text-[10.5px] font-semibold px-1.5 rounded-full',
                  isPast && 'bg-[#065F46]/10',
                  isCurrent && 'bg-white/18',
                  !isPast && !isCurrent && 'bg-[#F1F0EC] opacity-80'
                )}
                style={{
                  backgroundColor: isCurrent ? 'rgba(255,255,255,0.18)' : undefined,
                }}
              >
                {daysText}
              </span>
            )}
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
              style={{ borderRadius: 8 }}
            >
              {content}
            </button>
          )
        }

        return (
          <div key={opt.jhsId} className={cn(base, stateClass)} style={{ borderRadius: 8 }}>
            {content}
          </div>
        )
      })}
    </div>
  )
}

export default ProfileStageStrip

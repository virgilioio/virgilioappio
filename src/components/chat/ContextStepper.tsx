import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useJobHiringPlan, type HiringPlanInstance } from '@/hooks/useJobHiringPlan'
import { Skeleton } from '@/components/ui/skeleton'

interface ContextStepperProps {
  jobId: string | null
  currentStageId: string | null
}

/**
 * ContextStepper — vertical pipeline stepper (Step 1.8).
 * Reads the job's hiring plan instances and marks position relative to the
 * candidate's `current_stage_id` on the association.
 */
export function ContextStepper({ jobId, currentStageId }: ContextStepperProps) {
  const { loadHiringPlanInstances } = useJobHiringPlan()
  const [instances, setInstances] = useState<HiringPlanInstance[] | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    if (!jobId) {
      setInstances(null)
      return
    }
    setLoading(true)
    loadHiringPlanInstances(jobId).then((items) => {
      if (!alive) return
      setInstances(items)
      setLoading(false)
    })
    return () => {
      alive = false
    }
  }, [jobId, loadHiringPlanInstances])

  if (loading) {
    return (
      <div className="px-4 py-3 space-y-2.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded-full" />
            <Skeleton className="h-3.5 flex-1" />
          </div>
        ))}
      </div>
    )
  }

  if (!instances || instances.length === 0) return null

  const currentIdx = instances.findIndex((i) => i.stage.id === currentStageId)

  return (
    <div className="px-4 py-3">
      <h4 className="font-poppins font-semibold text-[10.5px] uppercase tracking-[0.06em] text-text-secondary mb-3">
        Pipeline
      </h4>
      <ol className="relative">
        {instances.map((inst, idx) => {
          const isCurrent = idx === currentIdx
          const isDone = currentIdx >= 0 && idx < currentIdx
          const isLast = idx === instances.length - 1
          const label = inst.customStageName || inst.stage.name

          return (
            <li key={inst.jhsId} className="relative flex items-start gap-3 pb-3 last:pb-0">
              {!isLast && (
                <span
                  className={cn(
                    'absolute left-[10px] top-5 bottom-0 w-px',
                    isDone ? 'bg-virgilio-purple/40' : 'bg-virgilio-border',
                  )}
                  aria-hidden
                />
              )}
              <span
                className={cn(
                  'relative z-10 mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0 border',
                  isCurrent &&
                    'bg-[#EDE4FF] border-virgilio-purple text-[#5B3FBF] ring-2 ring-virgilio-purple/20',
                  isDone && 'bg-virgilio-purple border-virgilio-purple text-white',
                  !isCurrent && !isDone && 'bg-surface-primary border-virgilio-border',
                )}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isDone ? (
                  <Check className="h-2.5 w-2.5" strokeWidth={3} />
                ) : (
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      isCurrent ? 'bg-virgilio-purple' : 'bg-virgilio-border',
                    )}
                  />
                )}
              </span>
              <span
                className={cn(
                  'text-[12px] font-inter pt-[3px] truncate',
                  isCurrent
                    ? 'font-medium text-virgilio-text'
                    : isDone
                      ? 'text-text-secondary line-through decoration-virgilio-purple/40'
                      : 'text-text-secondary',
                )}
              >
                {label}
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

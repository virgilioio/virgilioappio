import { useEffect, useState } from 'react'
import { Check } from 'lucide-react'
import { useJobHiringPlan, type HiringPlanInstance } from '@/hooks/useJobHiringPlan'
import { Skeleton } from '@/components/ui/skeleton'

interface ContextStepperProps {
  jobId: string | null
  currentStageId: string | null
  currentStageName: string | null
  jobTitle: string | null
  jobDepartment: string | null
  jobEmploymentType: string | null
}

function formatEmploymentType(v: string | null | undefined) {
  if (!v) return null
  return v
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

/**
 * ContextStepper — white pipeline card with vertical stage stepper.
 */
export function ContextStepper({
  jobId,
  currentStageId,
  currentStageName,
  jobTitle,
  jobDepartment,
  jobEmploymentType,
}: ContextStepperProps) {
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

  const currentIdx =
    instances && currentStageId ? instances.findIndex((i) => i.jhsId === currentStageId) : -1
  const employmentLabel = formatEmploymentType(jobEmploymentType)
  const subLine = [jobDepartment, employmentLabel].filter(Boolean).join(' · ')

  return (
    <section
      style={{
        background: '#FFFFFF',
        border: '1px solid #E7E8EE',
        borderRadius: 12,
        padding: 16,
      }}
    >
      <header className="flex items-center" style={{ marginBottom: 12 }}>
        <span
          className="font-poppins"
          style={{ fontSize: 12.5, fontWeight: 600, color: '#0d0d09' }}
        >
          Pipeline
        </span>
        {currentStageName && (
          <span
            className="ml-auto font-inter inline-flex items-center"
            style={{
              padding: '2px 8px',
              borderRadius: 999,
              background: '#EDE4FF',
              color: '#5B21B6',
              fontWeight: 500,
              fontSize: 11,
            }}
          >
            {currentStageName}
          </span>
        )}
      </header>

      {jobTitle && (
        <div
          className="font-inter"
          style={{ fontSize: 12.5, fontWeight: 500, color: '#1F2230' }}
        >
          {jobTitle}
        </div>
      )}
      {subLine && (
        <div
          className="font-inter"
          style={{ marginTop: 2, fontSize: 11, color: '#8B8F9E' }}
        >
          {subLine}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        {loading ? (
          <div className="space-y-2.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3.5 w-3.5 rounded-full" />
                <Skeleton className="h-3 flex-1" />
              </div>
            ))}
          </div>
        ) : instances && instances.length > 0 ? (
          <ol className="relative">
            {instances.map((inst, idx) => {
              const isCurrent = idx === currentIdx
              const isDone = currentIdx >= 0 && idx < currentIdx
              const isLast = idx === instances.length - 1
              const label = inst.customStageName || inst.stage.stage_name

              const nodeBg = isCurrent ? '#6F3FF5' : isDone ? '#D7C5FB' : '#FFFFFF'
              const nodeBorder = isCurrent
                ? '#6F3FF5'
                : isDone
                  ? '#D7C5FB'
                  : '#E7E8EE'
              const connectorColor = isDone ? '#D7C5FB' : '#E7E8EE'

              const labelColor = isCurrent
                ? '#0d0d09'
                : isDone
                  ? '#5A6072'
                  : '#8B8F9E'
              const labelFont = isCurrent ? 'font-poppins' : 'font-inter'
              const labelWeight = isCurrent ? 600 : 400

              return (
                <li
                  key={inst.jhsId}
                  className="relative flex items-start"
                  style={{
                    gap: 11,
                    minHeight: isLast ? 24 : 32,
                  }}
                >
                  <div className="relative flex flex-col items-center" style={{ width: 13 }}>
                    <span
                      className="rounded-full flex items-center justify-center shrink-0"
                      style={{
                        height: 13,
                        width: 13,
                        background: nodeBg,
                        border: `1.5px solid ${nodeBorder}`,
                      }}
                      aria-current={isCurrent ? 'step' : undefined}
                    >
                      {isDone && (
                        <Check
                          style={{ height: 8, width: 8, color: '#FFFFFF' }}
                          strokeWidth={3}
                        />
                      )}
                    </span>
                    {!isLast && (
                      <span
                        aria-hidden
                        style={{
                          flex: 1,
                          width: 1.5,
                          background: connectorColor,
                          marginTop: 2,
                          minHeight: 12,
                        }}
                      />
                    )}
                  </div>
                  <span
                    className={`${labelFont} truncate`}
                    style={{
                      fontSize: 12.5,
                      color: labelColor,
                      fontWeight: labelWeight,
                      lineHeight: 1.15,
                    }}
                  >
                    {label}
                  </span>
                </li>
              )
            })}
          </ol>
        ) : (
          <p className="font-inter" style={{ fontSize: 12, color: '#8B8F9E', margin: 0 }}>
            No pipeline configured.
          </p>
        )}
      </div>
    </section>
  )
}

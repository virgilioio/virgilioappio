import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link2, ArrowLeft, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabaseClient'
import { useJobHiringPlan } from '@/hooks/useJobHiringPlan'
import { cn } from '@/lib/utils'

interface LinkedToJobBannerProps {
  jobId: string
  jobTitle?: string | null
  /** Number of candidates just backfilled into the selected stage. */
  movedCount?: number
  /** jhs id of the default stage chosen during link. */
  defaultStageJhsId?: string | null
  defaultStageName?: string | null
  /** Persist dismissal per project so reload doesn't keep showing the banner. */
  storageKey?: string
}

/**
 * Green "Linked + flowing" banner shown after a sourcing project is linked to a job.
 * Includes a pipeline preview strip of stages with current counts.
 * Dismissible via the Done button.
 */
export function LinkedToJobBanner({
  jobId,
  jobTitle,
  movedCount = 0,
  defaultStageJhsId = null,
  defaultStageName,
  storageKey,
}: LinkedToJobBannerProps) {
  const navigate = useNavigate()
  const { loadHiringPlanInstances } = useJobHiringPlan()
  const [stages, setStages] = useState<{ jhsId: string; label: string; count: number }[]>([])
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined' || !storageKey) return false
    return sessionStorage.getItem(storageKey) === '1'
  })

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const opts = await loadHiringPlanInstances(jobId)
      if (cancelled) return

      // Fetch counts per stage
      const { data: assoc } = await supabase
        .from('job_candidate_associations')
        .select('current_stage_id')
        .eq('job_id', jobId)
        .eq('status', 'active')

      const counts = new Map<string, number>()
      for (const row of (assoc as any[]) ?? []) {
        if (!row.current_stage_id) continue
        counts.set(row.current_stage_id, (counts.get(row.current_stage_id) || 0) + 1)
      }

      setStages(
        opts.slice(0, 4).map(s => ({
          jhsId: s.jhsId,
          label: (s.customStageName || s.stage.stage_name).toUpperCase(),
          count: counts.get(s.jhsId) || 0,
        }))
      )
    })()
    return () => { cancelled = true }
  }, [jobId, loadHiringPlanInstances])

  const stageLabel = useMemo(() => {
    if (defaultStageName) return defaultStageName
    return stages.find(s => s.jhsId === defaultStageJhsId)?.label
  }, [defaultStageName, defaultStageJhsId, stages])

  if (dismissed) return null

  const handleDone = () => {
    if (storageKey && typeof window !== 'undefined') {
      sessionStorage.setItem(storageKey, '1')
    }
    setDismissed(true)
  }

  return (
    <div className="rounded-lg border border-success/40 bg-success/10 px-4 py-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-success/25 text-success">
          <Link2 className="h-3.5 w-3.5" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-text-primary">
            <span className="font-medium">Linked to </span>
            <span className="font-medium text-virgilio-purple">{jobTitle || 'job'}</span>
          </p>
          <p className="text-[13px] text-text-secondary mt-0.5">
            {movedCount > 0 ? (
              <>{movedCount} collected candidate{movedCount !== 1 ? 's' : ''} moved into <strong className="text-text-primary font-medium">{stageLabel || 'the default stage'}</strong> · future collects flow there automatically.</>
            ) : (
              <>Future collects flow into <strong className="text-text-primary font-medium">{stageLabel || 'the default stage'}</strong> automatically.</>
            )}
          </p>
        </div>
      </div>

      {/* Pipeline preview cards */}
      {stages.length > 0 && (
        <div className="mt-3 grid grid-cols-4 gap-2">
          {stages.map((s) => {
            const isDefault = s.jhsId === defaultStageJhsId
            const showPlus = isDefault && movedCount > 0
            return (
              <div
                key={s.jhsId}
                className={cn(
                  'rounded-xl px-3 py-2.5 flex flex-col gap-1',
                  isDefault
                    ? 'bg-[#EDE4FF] text-virgilio-purple'
                    : 'bg-[#FAFAF7]'
                )}
              >
                <span
                  className={cn(
                    'text-[10.5px] font-medium uppercase tracking-[0.06em] font-inter',
                    isDefault ? 'text-virgilio-purple' : 'text-text-secondary'
                  )}
                >
                  {s.label}
                </span>
                <span
                  className={cn(
                    'font-poppins font-semibold text-[22px] tabular-nums leading-none',
                    isDefault ? 'text-virgilio-purple' : 'text-text-primary'
                  )}
                >
                  {s.count}
                  {showPlus && <span className="ml-1.5">+{movedCount}</span>}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Actions */}
      <div className="mt-3 flex items-center gap-2">
        <Button size="sm" variant="primary" icon={TrendingUp} onClick={() => navigate(`/jobs/${jobId}`)}>
          Open pipeline
        </Button>
        <Button variant="secondary" size="sm" icon={ArrowLeft} onClick={() => navigate('/find')}>
          Back to Find
        </Button>
        <div className="ml-auto" />
        <Button variant="ghost" size="sm" onClick={handleDone}>
          Done
        </Button>
      </div>
    </div>
  )
}

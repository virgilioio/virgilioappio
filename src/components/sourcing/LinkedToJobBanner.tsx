import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link2, ArrowLeft, ArrowRight } from 'lucide-react'
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
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-success/25 text-success">
          <Link2 className="h-3.5 w-3.5" />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-[13px] text-text-primary">
            <span className="font-medium">Linked to {jobTitle || 'job'}.</span>{' '}
            <span className="text-text-secondary">
              {movedCount > 0 ? (
                <>{movedCount} collected candidate{movedCount !== 1 ? 's' : ''} moved into <strong>{stageLabel || 'the default stage'}</strong>. Future collects flow there automatically.</>
              ) : (
                <>Future collects flow into <strong>{stageLabel || 'the default stage'}</strong> automatically.</>
              )}
            </span>
          </p>

          {/* Pipeline preview */}
          {stages.length > 0 && (
            <div className="mt-2.5 flex items-center gap-1.5 flex-wrap">
              {stages.map(s => {
                const isDefault = s.jhsId === defaultStageJhsId
                return (
                  <div
                    key={s.jhsId}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[10.5px] font-medium uppercase tracking-[0.06em]',
                      isDefault
                        ? 'bg-[#EDE4FF] text-virgilio-purple'
                        : 'bg-background/60 text-text-secondary border border-border'
                    )}
                  >
                    <span>{s.label}</span>
                    <span className="font-poppins tabular-nums">
                      {s.count}
                      {isDefault && movedCount > 0 && (
                        <span className="ml-0.5 text-virgilio-purple">+{movedCount}</span>
                      )}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="mt-3 flex items-center justify-end gap-1.5 pt-2 border-t border-success/30">
        <Button variant="ghost" size="sm" icon={ArrowLeft} onClick={() => navigate('/find')}>
          Back to Find
        </Button>
        <Button variant="ghost" size="sm" onClick={handleDone}>
          Done
        </Button>
        <Button size="sm" iconRight={ArrowRight} onClick={() => navigate(`/jobs/${jobId}`)}>
          Open pipeline
        </Button>
      </div>
    </div>
  )
}

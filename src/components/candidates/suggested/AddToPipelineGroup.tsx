import * as React from 'react'
import { ArrowRight, Briefcase, CheckCircle2, Plus, ThumbsDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'
import { useJobHiringPlan } from '@/hooks/useJobHiringPlan'
import { usePipelineActions } from '@/hooks/usePipelineActions'

export interface AddToPipelineGroupProps {
  jobId: string
  candidateId: string
  /** The stage the person is now in, or null while they are still a suggestion. */
  addedStage: string | null
  onAdded: (stageName: string) => void
  onUndo: () => void
  onDismiss: () => void
  onOpenInPipeline: () => void
  onAddToOtherJob: () => void
  /** Rejected for this job before — the popover header changes wording. */
  previouslyRejected?: boolean
  size?: 'sm' | 'lg'
}

/**
 * The one decision this screen exists for: add them to a stage of this job's
 * pipeline, or dismiss the suggestion. Adding sends no email.
 */
export function AddToPipelineGroup({
  jobId,
  candidateId,
  addedStage,
  onAdded,
  onUndo,
  onDismiss,
  onOpenInPipeline,
  onAddToOtherJob,
  previouslyRejected,
  size = 'sm',
}: AddToPipelineGroupProps) {
  const [open, setOpen] = React.useState(false)
  const [busy, setBusy] = React.useState(false)
  const [stages, setStages] = React.useState<{ jhsId: string; name: string; count: number | null }[]>([])
  const wrapperRef = React.useRef<HTMLDivElement | null>(null)
  const { loadHiringPlanInstances } = useJobHiringPlan()
  const { createAssociationAndMove } = usePipelineActions()
  const control = size === 'lg' ? 34 : 30

  React.useEffect(() => {
    if (!open || stages.length) return
    let cancelled = false
    const load = async () => {
      const plan = await loadHiringPlanInstances(jobId)
      const { data } = await supabase
        .from('job_candidate_associations')
        .select('current_stage_id')
        .eq('job_id', jobId)
        .eq('status', 'active')
      const counts = new Map<string, number>()
      ;(data || []).forEach((row: any) => {
        if (row.current_stage_id) counts.set(row.current_stage_id, (counts.get(row.current_stage_id) || 0) + 1)
      })
      if (cancelled) return
      setStages(
        (plan || []).map((instance) => ({
          jhsId: instance.jhsId,
          name: instance.customStageName || instance.stage.stage_name,
          count: counts.get(instance.jhsId) ?? 0,
        })),
      )
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [open, stages.length, jobId, loadHiringPlanInstances])

  React.useEffect(() => {
    if (!open) return
    const onDown = (event: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const add = async (stage: { jhsId: string; name: string }) => {
    setOpen(false)
    setBusy(true)
    // Optimistic: the confirmation appears before the write settles.
    onAdded(stage.name)
    try {
      await createAssociationAndMove(jobId, candidateId, stage.jhsId)
    } catch {
      onUndo()
      toast({ title: 'Could not add', description: 'The candidate was not added to the pipeline.', variant: 'destructive' })
    } finally {
      setBusy(false)
    }
  }

  const undo = async () => {
    onUndo()
    const { error } = await supabase
      .from('job_candidate_associations')
      .delete()
      .eq('job_id', jobId)
      .eq('candidate_id', candidateId)
    if (error) {
      toast({ title: 'Could not undo', description: 'The candidate is still in the pipeline.', variant: 'destructive' })
    }
  }

  if (addedStage) {
    return (
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-full border border-[#CBEEDD] bg-[#F6FCF9] px-2.5 font-poppins text-[12.5px] font-medium text-[#13432F]"
          style={{ height: control }}
        >
          <CheckCircle2 className="h-3.5 w-3.5 text-[#12B886]" />
          Added to {addedStage}
        </span>
        <Button variant="secondary" size={size === 'lg' ? 'md' : 'sm'} iconRight={ArrowRight} onClick={onOpenInPipeline}>
          Open in pipeline
        </Button>
        <button
          type="button"
          onClick={() => void undo()}
          className="font-inter text-[11.5px] font-medium text-[#5A6072] hover:text-[#1F2230] transition-colors"
        >
          Undo
        </button>
      </div>
    )
  }

  return (
    <div ref={wrapperRef} className="relative inline-flex shrink-0 items-center gap-1.5">
      <Button
        variant="primary"
        size={size === 'lg' ? 'md' : 'sm'}
        icon={Plus}
        loading={busy}
        onClick={() => setOpen((value) => !value)}
      >
        Add to pipeline
      </Button>
      <button
        type="button"
        onClick={onDismiss}
        title="Not a fit"
        aria-label="Not a fit"
        className="inline-flex items-center justify-center rounded-lg border border-[#E7E8EE] bg-white text-[#8B8F9E] transition-colors hover:bg-[#FAFAF7] hover:text-[#5A6072]"
        style={{ width: control, height: control }}
      >
        <ThumbsDown className="h-[14px] w-[14px]" strokeWidth={2} />
      </button>

      {open && (
        <div
          className="absolute right-0 z-[90] w-[268px] rounded-[12px] border border-[#E7E8EE] bg-white p-1.5 shadow-[0_16px_40px_-12px_rgba(13,13,9,.22)]"
          style={{ top: control + 6 }}
        >
          <p className="px-2 py-1.5 font-inter text-[10.5px] font-semibold uppercase tracking-[0.06em] text-[#8B8F9E]">
            {previouslyRejected ? 'Re-add to which stage' : 'Add to which stage'}
          </p>
          {stages.length === 0 ? (
            <p className="px-2 pb-2 font-inter text-[11.5px] text-[#8B8F9E]">Loading this job's stages…</p>
          ) : (
            stages.map((stage) => (
              <button
                key={stage.jhsId}
                type="button"
                onClick={() => void add(stage)}
                className="flex w-full items-center gap-2 rounded-lg px-2.5 py-[7px] text-left transition-colors hover:bg-[#FAFAF7]"
              >
                <span className="min-w-0 flex-1 truncate font-poppins text-[12.5px] font-medium text-[#1F2230]">{stage.name}</span>
                <span className="shrink-0 font-inter text-[11px] text-[#8B8F9E]">
                  {stage.count === null ? '' : `${stage.count} in stage`}
                </span>
              </button>
            ))
          )}
          <div className="my-1.5 h-px bg-[#F1F0EC]" />
          <button
            type="button"
            onClick={() => {
              setOpen(false)
              onAddToOtherJob()
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left transition-colors hover:bg-[#FAFAF7]"
          >
            <Briefcase className="h-3.5 w-3.5 text-[#5A6072]" strokeWidth={2} />
            <span className="font-inter text-[12.5px] font-medium text-[#1F2230]">Add to a different job…</span>
          </button>
        </div>
      )}
    </div>
  )
}

export default AddToPipelineGroup

import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useJobs } from '@/hooks/useJobs'
import { useJobHiringPlan } from '@/hooks/useJobHiringPlan'
import { usePipelineActions } from '@/hooks/usePipelineActions'
import { toast } from '@/hooks/use-toast'

interface BulkAddToJobPipelineDialogProps {
  candidateIds: string[]
  onCompleted?: () => void
  disabled?: boolean
}

export default function BulkAddToJobPipelineDialog({ candidateIds, onCompleted, disabled }: BulkAddToJobPipelineDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>(undefined)
  const [stageOptions, setStageOptions] = useState<{ jhsId: string; stage: { stage_name: string }; position: number }[]>([])
  const [selectedStageId, setSelectedStageId] = useState<string | undefined>(undefined)
  const [loadingStages, setLoadingStages] = useState(false)
  const { jobs, isLoading: jobsLoading, getJobs } = useJobs()
  const { loadHiringPlanInstances } = useJobHiringPlan()
  const { createAssociationAndMove } = usePipelineActions()

  useEffect(() => {
    if (open) getJobs()
  }, [open, getJobs])

  useEffect(() => {
    const loadStages = async () => {
      if (!selectedJobId) return
      setLoadingStages(true)
      try {
        const plan = await loadHiringPlanInstances(selectedJobId)
        setStageOptions(plan || [])
        setSelectedStageId(plan?.[0]?.jhsId)
      } finally {
        setLoadingStages(false)
      }
    }
    loadStages()
  }, [selectedJobId, loadHiringPlanInstances])

  const onConfirm = async () => {
    if (!selectedJobId || !selectedStageId || candidateIds.length === 0) return
    try {
      const results = await Promise.allSettled(
        candidateIds.map(id => createAssociationAndMove(selectedJobId, id, selectedStageId))
      )
      const successes = results.filter(r => r.status === 'fulfilled').length
      const failures = results.length - successes
      if (successes) {
        toast({ title: 'Success', description: `${successes} candidate(s) moved to pipeline.` })
      }
      if (failures) {
        toast({ title: 'Some failed', description: `${failures} candidate(s) could not be moved.`, variant: 'destructive' })
      }
      setOpen(false)
      onCompleted?.()
    } catch (e) {
      // errors are toasted in hook
    }
  }

  const jobOptions = useMemo(() => jobs.filter(j => j.status !== 'archived'), [jobs])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2" disabled={disabled || candidateIds.length === 0}>Move to pipeline</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move {candidateIds.length} candidate(s) to a job pipeline</DialogTitle>
          <DialogDescription>Select a job and stage for the selected candidates.</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm text-text-secondary">Job</label>
            <Select value={selectedJobId} onValueChange={setSelectedJobId}>
              <SelectTrigger>
                <SelectValue placeholder={jobsLoading ? 'Loading jobs…' : 'Select a job'} />
              </SelectTrigger>
              <SelectContent>
                {jobOptions.map(job => (
                  <SelectItem key={job.id} value={job.id}>{job.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm text-text-secondary">Stage</label>
            <Select value={selectedStageId} onValueChange={setSelectedStageId} disabled={!selectedJobId || loadingStages || stageOptions.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={!selectedJobId ? 'Select a job first' : (loadingStages ? 'Loading stages…' : (stageOptions.length ? 'Select a stage' : 'No stages for this job'))} />
              </SelectTrigger>
              <SelectContent>
                {stageOptions.map(opt => (
                  <SelectItem key={opt.jhsId} value={opt.jhsId}>{opt.stage.stage_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={onConfirm} disabled={!selectedJobId || !selectedStageId}>Confirm</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

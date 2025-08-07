import { useEffect, useMemo, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useJobs } from '@/hooks/useJobs'
import { useJobHiringPlan, JobStage } from '@/hooks/useJobHiringPlan'
import { usePipelineActions } from '@/hooks/usePipelineActions'
import { toast } from '@/hooks/use-toast'

interface AddToJobPipelineDialogProps {
  candidateId: string
}

export default function AddToJobPipelineDialog({ candidateId }: AddToJobPipelineDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedJobId, setSelectedJobId] = useState<string | undefined>(undefined)
  const [stages, setStages] = useState<JobStage[]>([])
  const [selectedStageId, setSelectedStageId] = useState<string | undefined>(undefined)
  const [loadingStages, setLoadingStages] = useState(false)
  const { jobs, isLoading: jobsLoading, getJobs } = useJobs()
  const { loadHiringPlan } = useJobHiringPlan()
  const { createAssociationAndMove } = usePipelineActions()

  useEffect(() => {
    if (open) getJobs()
  }, [open, getJobs])

  useEffect(() => {
    const loadStages = async () => {
      if (!selectedJobId) return
      setLoadingStages(true)
      try {
        const plan = await loadHiringPlan(selectedJobId)
        setStages(plan || [])
        setSelectedStageId(plan?.[0]?.id)
      } finally {
        setLoadingStages(false)
      }
    }
    loadStages()
  }, [selectedJobId, loadHiringPlan])

  const onConfirm = async () => {
    if (!selectedJobId || !selectedStageId) return
    try {
      await createAssociationAndMove(selectedJobId, candidateId, selectedStageId)
      setOpen(false)
      toast({ title: 'Success', description: 'Candidate moved to selected pipeline.' })
    } catch (e) {
      // errors are toasted in hook
    }
  }

  const jobOptions = useMemo(() => jobs.filter(j => j.status !== 'archived'), [jobs])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">Move to pipeline</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move to job pipeline</DialogTitle>
          <DialogDescription>Select a job and stage to add this candidate to the pipeline.</DialogDescription>
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
            <Select value={selectedStageId} onValueChange={setSelectedStageId} disabled={!selectedJobId || loadingStages || stages.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={!selectedJobId ? 'Select a job first' : (loadingStages ? 'Loading stages…' : (stages.length ? 'Select a stage' : 'No stages for this job'))} />
              </SelectTrigger>
              <SelectContent>
                {stages.map(stage => (
                  <SelectItem key={stage.id} value={stage.id}>{stage.stage_name}</SelectItem>
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

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import { useJobsForCandidateAssignment, type JobOption } from '@/hooks/useJobsForCandidateAssignment'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useJobHiringPlan } from '@/hooks/useJobHiringPlan'

interface JobSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onJobSelected: (jobId: string, stageId?: string) => void
  onSkip: () => void
}

export function JobSelectionDialog({
  open,
  onOpenChange,
  onJobSelected,
  onSkip,
}: JobSelectionDialogProps) {
  const [selectedJobId, setSelectedJobId] = useState<string>('')
  const [selectedStageId, setSelectedStageId] = useState<string>('')
  const [stageOptions, setStageOptions] = useState<Array<{ jhsId: string; label: string }>>([])
  const [isLoadingStages, setIsLoadingStages] = useState(false)
  
  const { jobs, isLoading } = useJobsForCandidateAssignment()
  const { loadHiringPlanInstances } = useJobHiringPlan()

  // Load stages when job is selected
  useEffect(() => {
    async function loadStages() {
      if (!selectedJobId) {
        setStageOptions([])
        setSelectedStageId('')
        return
      }

      setIsLoadingStages(true)
      try {
        const stages = await loadHiringPlanInstances(selectedJobId)
        setStageOptions(
          stages.map((s) => ({
            jhsId: s.jhsId,
            label: s.customStageName || s.stage.stage_name,
          }))
        )
      } catch (error) {
        console.error('Failed to load stages:', error)
        setStageOptions([])
      } finally {
        setIsLoadingStages(false)
      }
    }

    loadStages()
  }, [selectedJobId, loadHiringPlanInstances])

  const jobOptions = jobs.map((job) => ({
    value: job.id,
    label: `${job.title} - ${job.organization_name}`,
  }))

  const handleConfirm = () => {
    if (selectedJobId && selectedStageId) {
      onJobSelected(selectedJobId, selectedStageId)
      setSelectedJobId('')
      setSelectedStageId('')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Select Job for Candidate</DialogTitle>
          <DialogDescription>
            Choose which job and stage you want to add this candidate to, or skip to collect without adding to a job.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-text-tertiary" />
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">Job</label>
                <SearchableSelect
                  options={jobOptions}
                  value={selectedJobId}
                  onValueChange={setSelectedJobId}
                  placeholder="Select a job..."
                  searchPlaceholder="Search jobs..."
                  emptyMessage="No jobs found"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-text-primary">Stage</label>
                <Select
                  value={selectedStageId}
                  onValueChange={setSelectedStageId}
                  disabled={!selectedJobId || isLoadingStages}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={
                      !selectedJobId 
                        ? "Select a job first" 
                        : isLoadingStages 
                        ? "Loading stages..." 
                        : "Select a stage..."
                    } />
                  </SelectTrigger>
                  <SelectContent>
                    {stageOptions.map((stage) => (
                      <SelectItem key={stage.jhsId} value={stage.jhsId}>
                        {stage.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 pt-4 border-t">
          <Button
            variant="outline"
            onClick={onSkip}
            className="flex-1"
          >
            Skip - Collect Without Job
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedJobId || !selectedStageId || isLoadingStages}
          >
            Confirm
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

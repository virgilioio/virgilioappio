import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useJobHiringPlan } from '@/hooks/useJobHiringPlan'
import { Loader2, Users } from 'lucide-react'

interface AddCollectedToPipelineDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  jobId: string
  candidateCount: number
  onConfirm: (stageId: string) => Promise<void>
  onSkip: () => void
}

export function AddCollectedToPipelineDialog({
  open,
  onOpenChange,
  jobId,
  candidateCount,
  onConfirm,
  onSkip,
}: AddCollectedToPipelineDialogProps) {
  const [stageOptions, setStageOptions] = useState<
    { jhsId: string; stage: { stage_name: string }; position: number }[]
  >([])
  const [selectedStageId, setSelectedStageId] = useState<string | undefined>(undefined)
  const [loadingStages, setLoadingStages] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const { loadHiringPlanInstances } = useJobHiringPlan()

  useEffect(() => {
    const loadStages = async () => {
      if (!open || !jobId) return
      setLoadingStages(true)
      try {
        const options = await loadHiringPlanInstances(jobId)
        setStageOptions(options || [])
        // Default to first stage
        if (options && options.length > 0) {
          setSelectedStageId(options[0].jhsId)
        }
      } finally {
        setLoadingStages(false)
      }
    }
    loadStages()
  }, [open, jobId, loadHiringPlanInstances])

  const handleConfirm = async () => {
    if (!selectedStageId) return
    setIsSubmitting(true)
    try {
      await onConfirm(selectedStageId)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleSkip = () => {
    onSkip()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Add candidates to pipeline?
          </DialogTitle>
          <DialogDescription>
            You have <strong>{candidateCount}</strong> collected candidate{candidateCount !== 1 ? 's' : ''} in this search. 
            Would you like to add them to the job's pipeline?
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Select pipeline stage</label>
            <Select
              value={selectedStageId}
              onValueChange={setSelectedStageId}
              disabled={loadingStages || stageOptions.length === 0}
            >
              <SelectTrigger>
                <SelectValue
                  placeholder={
                    loadingStages
                      ? 'Loading stages...'
                      : stageOptions.length
                        ? 'Select a stage'
                        : 'No stages configured'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {stageOptions.map((opt) => (
                  <SelectItem key={opt.jhsId} value={opt.jhsId}>
                    {opt.stage.stage_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleSkip}
            disabled={isSubmitting}
            className="w-full sm:w-auto"
          >
            No, I'll add them later
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!selectedStageId || isSubmitting || loadingStages}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              `Yes, add ${candidateCount} to pipeline`
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

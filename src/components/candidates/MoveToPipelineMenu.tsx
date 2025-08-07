
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useJobHiringPlan, JobStage } from '@/hooks/useJobHiringPlan'
import { usePipelineActions } from '@/hooks/usePipelineActions'
import { toast } from '@/hooks/use-toast'
import { MoveRight } from 'lucide-react'

interface MoveToPipelineMenuProps {
  jobId: string
  candidateId: string // independent candidates.id
  buttonText?: string
}

/**
 * Reusable button+menu to add a candidate to a job's pipeline.
 * Intended to be embedded in the candidate profile name card.
 */
export default function MoveToPipelineMenu({ jobId, candidateId, buttonText = 'Move to pipeline' }: MoveToPipelineMenuProps) {
  const { loadHiringPlan } = useJobHiringPlan()
  const { createAssociationAndMove } = usePipelineActions()
  const [stages, setStages] = useState<JobStage[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!jobId) return
    ;(async () => {
      const plan = await loadHiringPlan(jobId)
      setStages(plan || [])
    })()
  }, [jobId, loadHiringPlan])

  const handleSelectStage = async (stageId: string) => {
    if (!jobId || !candidateId) return
    setLoading(true)
    try {
      await createAssociationAndMove(jobId, candidateId, stageId)
      toast({
        title: 'Success',
        description: 'Candidate added to pipeline.',
      })
    } catch (e) {
      // Error is already toasted in hook
    } finally {
      setLoading(false)
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" disabled={loading || stages.length === 0} className="gap-2">
          <MoveRight className="h-4 w-4" />
          {stages.length === 0 ? 'No stages' : buttonText}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[220px]">
        <DropdownMenuLabel>Move to stage</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {stages.length === 0 ? (
          <div className="px-2 py-1.5 text-xs text-text-tertiary">No stages available</div>
        ) : (
          stages.map(stage => (
            <DropdownMenuItem key={stage.id} onClick={() => handleSelectStage(stage.id)}>
              {stage.stage_name}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}


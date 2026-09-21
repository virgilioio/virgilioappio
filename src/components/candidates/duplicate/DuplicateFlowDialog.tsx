import { useState } from 'react'
import { toast } from '@/hooks/use-toast'
import { DuplicateCandidateDialog } from './DuplicateCandidateDialog'
import { performMerge, performNotDuplicate } from './mergeActions'
import type { Resolution } from './types'

interface DuplicateFlowDialogProps {
  isOpen: boolean
  existingCandidate: { id: string } | null
  incoming: Record<string, any> | null
  jobId?: string | null
  stageId?: string | null
  notes?: string | null
  organizationId?: string | null
  incomingFileName?: string | null
  incomingProvenance?: string | null
  onCancel: () => void
  /** Called after a successful merge or a separate candidate being created. */
  onResolved: (candidateId: string, mode: 'merged' | 'separate') => void
  onOpenProfile?: () => void
}

/**
 * Wraps the duplicate dialog with the two write paths, so every add-candidate
 * surface behaves identically.
 */
export function DuplicateFlowDialog({
  isOpen,
  existingCandidate,
  incoming,
  jobId,
  stageId,
  notes,
  organizationId,
  incomingFileName,
  incomingProvenance,
  onCancel,
  onResolved,
  onOpenProfile,
}: DuplicateFlowDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  if (!existingCandidate) return null

  const handleMerge = async (resolutions: Record<string, Resolution>) => {
    setIsSubmitting(true)
    try {
      const result = await performMerge({
        existingCandidateId: existingCandidate.id,
        incoming: incoming ?? {},
        resolutions,
        jobId,
        stageId,
        notes,
      })
      toast({ title: 'Records merged', description: 'Nothing was dropped — the change is in the audit log.' })
      onResolved(result.candidate_id, 'merged')
    } catch (err) {
      toast({
        title: 'The merge did not go through',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleNotDuplicate = async () => {
    setIsSubmitting(true)
    try {
      const result = await performNotDuplicate({
        existingCandidateId: existingCandidate.id,
        incoming: incoming ?? {},
        jobId,
        stageId,
        notes,
        organizationId,
      })
      toast({
        title: 'Added as a separate person',
        description: 'We will not raise this pair as a duplicate again.',
      })
      onResolved(result.candidate_id, 'separate')
    } catch (err) {
      toast({
        title: 'Could not create a separate candidate',
        description: err instanceof Error ? err.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <DuplicateCandidateDialog
      isOpen={isOpen}
      existingCandidateId={existingCandidate.id}
      incoming={incoming}
      incomingFileName={incomingFileName ?? null}
      incomingProvenance={incomingProvenance ?? null}
      isSubmitting={isSubmitting}
      onCancel={onCancel}
      onMerge={handleMerge}
      onNotDuplicate={handleNotDuplicate}
      onOpenProfile={onOpenProfile}
    />
  )
}

export default DuplicateFlowDialog

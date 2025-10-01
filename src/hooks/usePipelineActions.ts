import { useCallback } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { toast } from '@/hooks/use-toast'

export interface PipelineAssociation {
  id: string
  job_id: string
  candidate_id: string
  current_stage_id: string | null
  pipeline_position: number | null
  candidate_name: string
  linkedin_url?: string | null
  created_at: string
  entered_stage_at: string | null
  status: 'active' | 'rejected' | 'hired' | 'offer' | string
}

/**
 * Hook providing basic pipeline operations:
 * - fetchAssociationsForJob: returns associations with candidate names
 * - moveAssociationToStage: updates stage (position auto-assigned by trigger)
 * - createAssociationAndMove: creates association (if missing) and sets stage
 */
export function usePipelineActions() {
  const fetchAssociationsForJob = useCallback(async (jobId: string): Promise<PipelineAssociation[]> => {
    // 1) Load associations for job
    const { data: associations, error: assocError } = await supabase
      .from('job_candidate_associations')
      .select('id, job_id, candidate_id, current_stage_id, pipeline_position, created_at, entered_stage_at, status')
      .eq('job_id', jobId)
      .order('pipeline_position', { ascending: true })

    if (assocError) {
      console.error('Error fetching associations:', assocError)
      toast({
        title: 'Error',
        description: 'Failed to load pipeline candidates.',
        variant: 'destructive',
      })
      return []
    }

    if (!associations || associations.length === 0) return []

    const candidateIds = Array.from(new Set(associations.map(a => a.candidate_id)))

    // 2) Load candidate names/links from independent candidates table
    const { data: candidates, error: candError } = await supabase
      .from('candidates')
      .select('id, candidate_name, linkedin_url')
      .in('id', candidateIds as string[])

    if (candError) {
      console.error('Error fetching candidates:', candError)
      toast({
        title: 'Error',
        description: 'Failed to load candidate details.',
        variant: 'destructive',
      })
      return []
    }

    const byId = new Map((candidates || []).map(c => [c.id, c]))
    const result: PipelineAssociation[] = associations.map(a => {
      const c = byId.get(a.candidate_id)
      return {
        id: a.id,
        job_id: a.job_id,
        candidate_id: a.candidate_id,
        current_stage_id: a.current_stage_id,
        pipeline_position: a.pipeline_position,
        candidate_name: c?.candidate_name || 'Unnamed Candidate',
        linkedin_url: c?.linkedin_url ?? null,
        created_at: a.created_at,
        entered_stage_at: a.entered_stage_at ?? null,
        status: (a as any).status ?? 'active',
      }
    })

    return result
  }, [])

  const moveAssociationToStage = useCallback(async (associationId: string, toStageId: string) => {
    console.log('[usePipelineActions.moveAssociationToStage] moving', { associationId, toStageId })
    const { data, error } = await supabase
      .from('job_candidate_associations')
      .update({ current_stage_id: toStageId, pipeline_position: null })
      .eq('id', associationId)
      .select('id') // attempt to return updated row

    if (error) {
      console.error('Error moving candidate:', error)
      toast({
        title: 'Error',
        description: 'Failed to move candidate to selected stage.',
        variant: 'destructive',
      })
      throw error
    }

    // If update succeeded but returned no rows (can happen if SELECT visibility is restricted by RLS),
    // verify via a follow-up read of the record.
    if (!data || data.length === 0) {
      console.warn('[usePipelineActions.moveAssociationToStage] update returned no rows; verifying via follow-up select', {
        associationId,
        toStageId,
      })
      const { data: verify, error: verifyError } = await supabase
        .from('job_candidate_associations')
        .select('id, current_stage_id')
        .eq('id', associationId)
        .maybeSingle()

      if (verifyError) {
        console.error('[usePipelineActions.moveAssociationToStage] verification select failed', verifyError)
        toast({
          title: 'Not moved',
          description:
            "The candidate may not have moved due to permissions or visibility. Please ensure you're assigned to this job and try again.",
          variant: 'destructive',
        })
        throw new Error('Update may have failed: no rows visible after update')
      }

      if (verify && verify.current_stage_id === toStageId) {
        console.log('[usePipelineActions.moveAssociationToStage] verification shows candidate moved successfully')
        toast({
          title: 'Candidate moved',
          description: 'Candidate moved to the selected stage.',
        })
        return
      }

      console.warn('[usePipelineActions.moveAssociationToStage] verification indicates candidate not moved', {
        verify,
      })
      toast({
        title: 'Not moved',
        description:
          "The candidate was not moved. You may not have permission, the stage/association may be invalid, or the hiring plan/stage isn't accessible.",
        variant: 'destructive',
      })
      throw new Error('No rows updated when moving candidate')
    }

    toast({
      title: 'Candidate moved',
      description: 'Candidate moved to the selected stage.',
    })
  }, [])

  const createAssociationAndMove = useCallback(async (jobId: string, candidateId: string, toStageId: string) => {
    console.log('[usePipelineActions.createAssociationAndMove] creating/moving', { jobId, candidateId, toStageId })
    // First check if association already exists
    const { data: existing, error: existingError } = await supabase
      .from('job_candidate_associations')
      .select('id')
      .eq('job_id', jobId)
      .eq('candidate_id', candidateId)
      .maybeSingle()

    if (existingError) {
      console.error('Error finding existing association:', existingError)
      toast({
        title: 'Error',
        description: 'Could not verify existing association.',
        variant: 'destructive',
      })
      throw existingError
    }

    if (existing?.id) {
      await moveAssociationToStage(existing.id, toStageId)
      return existing.id
    }

    // Create association and set stage
    const { data: created, error: createError } = await supabase
      .from('job_candidate_associations')
      .insert([{
        job_id: jobId,
        candidate_id: candidateId,
        current_stage_id: toStageId,
      }])
      .select('id') // ensure we get back the id if insert succeeded
      .single()

    if (createError) {
      console.error('Error creating association:', createError)
      toast({
        title: 'Error',
        description: 'Failed to add candidate to pipeline.',
        variant: 'destructive',
      })
      throw createError
    }

    if (!created?.id) {
      console.warn('[usePipelineActions.createAssociationAndMove] insert returned no id (RLS?)', { jobId, candidateId, toStageId })
      toast({
        title: 'Not added',
        description: 'Candidate was not added to the pipeline. You may not have permission for this job.',
        variant: 'destructive',
      })
      throw new Error('Association not created')
    }

    toast({
      title: 'Added to pipeline',
      description: 'Candidate added to the selected stage.',
    })

    return created.id
  }, [moveAssociationToStage])

  const updateAssociationStatus = useCallback(async (associationId: string, status: 'active' | 'rejected' | 'hired' | 'offer') => {
    console.log('[usePipelineActions.updateAssociationStatus] updating', { associationId, status })
    const { data, error } = await supabase
      .from('job_candidate_associations')
      .update({ status })
      .eq('id', associationId)
      .select('id')

    if (error) {
      console.error('Error updating status:', error)
      toast({ title: 'Error', description: 'Failed to update status.', variant: 'destructive' })
      throw error
    }

    if (!data || data.length === 0) {
      console.warn('[usePipelineActions.updateAssociationStatus] no rows updated (RLS or invalid id)', { associationId })
      toast({
        title: 'Not updated',
        description: 'The status was not changed. You may not have permission for this candidate/job.',
        variant: 'destructive',
      })
      throw new Error('No rows updated when changing status')
    }

    toast({ title: 'Status updated', description: `Candidate marked as ${status}.` })
  }, [])

  return {
    fetchAssociationsForJob,
    moveAssociationToStage,
    createAssociationAndMove,
    updateAssociationStatus,
  }
}


import { supabase } from '@/integrations/supabase/client'
import { toast } from '@/hooks/use-toast'

export interface PipelineAssociation {
  id: string
  job_id: string
  candidate_id: string
  current_stage_id: string | null
  pipeline_position: number | null
  candidate_name: string
  linkedin_url?: string | null
}

/**
 * Hook providing basic pipeline operations:
 * - fetchAssociationsForJob: returns associations with candidate names
 * - moveAssociationToStage: updates stage (position auto-assigned by trigger)
 * - createAssociationAndMove: creates association (if missing) and sets stage
 */
export function usePipelineActions() {
  const fetchAssociationsForJob = async (jobId: string): Promise<PipelineAssociation[]> => {
    // 1) Load associations for job
    const { data: associations, error: assocError } = await supabase
      .from('job_candidate_associations')
      .select('id, job_id, candidate_id, current_stage_id, pipeline_position')
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
      }
    })

    return result
  }

  const moveAssociationToStage = async (associationId: string, toStageId: string) => {
    // Set pipeline_position to null so the trigger assigns the next position
    const { error } = await supabase
      .from('job_candidate_associations')
      .update({ current_stage_id: toStageId, pipeline_position: null })
      .eq('id', associationId)

    if (error) {
      console.error('Error moving candidate:', error)
      toast({
        title: 'Error',
        description: 'Failed to move candidate to selected stage.',
        variant: 'destructive',
      })
      throw error
    }

    toast({
      title: 'Candidate moved',
      description: 'Candidate moved to the selected stage.',
    })
  }

  const createAssociationAndMove = async (jobId: string, candidateId: string, toStageId: string) => {
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
      .select('id')
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

    toast({
      title: 'Added to pipeline',
      description: 'Candidate added to the selected stage.',
    })

    return created.id
  }

  return {
    fetchAssociationsForJob,
    moveAssociationToStage,
    createAssociationAndMove,
  }
}


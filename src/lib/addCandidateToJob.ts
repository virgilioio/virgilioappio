import { supabase } from '@/lib/supabaseClient'

/**
 * Puts a candidate in a job (a chosen stage, or its entry stage), unless they're already in it.
 * The stage is current_stage_id from job_entry_stage(): Application Review
 * when the job has it, else its first stage, as Collect does (2026-10-12).
 * Returns false when they were already in the job.
 */
export async function addCandidateToJob(jobId: string, candidateId: string, stageId?: string | null): Promise<boolean> {
  const { data: existing, error: readError } = await supabase
    .from('job_candidate_associations')
    .select('id')
    .eq('job_id', jobId)
    .eq('candidate_id', candidateId)
    .maybeSingle()
  if (readError) throw readError
  if (existing) return false

  // A chosen stage, else Application Review when the job has it, else its first stage (2026-10-12).
  let entryStage: string | null = stageId ?? null
  if (!entryStage) {
    const { data, error: stageError } = await supabase.rpc('job_entry_stage', { p_job: jobId })
    if (stageError) throw stageError
    entryStage = (data as string | null) ?? null
  }

  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('job_candidate_associations').insert({
    job_id: jobId,
    candidate_id: candidateId,
    current_stage_id: entryStage ?? null,
    status: 'active',
    added_by: user?.id ?? null,
  })
  if (error) throw error
  return true
}

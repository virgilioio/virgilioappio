import { supabase } from '@/lib/supabaseClient'

/**
 * Puts a candidate in a job's first stage, unless they're already in it
 * (2026-10-11). job_candidate_associations has no `stage` column: the stage
 * is current_stage_id, the job's first hiring stage, as Collect does.
 * Returns false when they were already in the job.
 */
export async function addCandidateToJob(jobId: string, candidateId: string): Promise<boolean> {
  const { data: existing, error: readError } = await supabase
    .from('job_candidate_associations')
    .select('id')
    .eq('job_id', jobId)
    .eq('candidate_id', candidateId)
    .maybeSingle()
  if (readError) throw readError
  if (existing) return false

  const { data: firstStage, error: stageError } = await supabase
    .from('job_hiring_stages')
    .select('id')
    .eq('job_id', jobId)
    .order('position', { ascending: true })
    .limit(1)
    .maybeSingle()
  if (stageError) throw stageError

  const { data: { user } } = await supabase.auth.getUser()
  const { error } = await supabase.from('job_candidate_associations').insert({
    job_id: jobId,
    candidate_id: candidateId,
    current_stage_id: firstStage?.id ?? null,
    status: 'active',
    added_by: user?.id ?? null,
  })
  if (error) throw error
  return true
}

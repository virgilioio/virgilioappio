import { supabase } from '@/lib/supabaseClient'

/**
 * Triggers the AI fit analysis for a candidate-job pair.
 * Fire-and-forget: does not throw on failure, just logs.
 */
export async function triggerFitAnalysis(candidateId: string, jobId: string): Promise<void> {
  try {
    const { data, error } = await supabase.functions.invoke('analyze-candidate-fit', {
      body: { candidate_id: candidateId, job_id: jobId },
    })
    if (error) {
      console.error('[triggerFitAnalysis] Edge function error:', error)
    } else if (data?.error === 'no_job_description') {
      console.log('[triggerFitAnalysis] Skipped: no job description')
    } else {
      console.log('[triggerFitAnalysis] Analysis complete for', candidateId, jobId)
    }
  } catch (e) {
    console.error('[triggerFitAnalysis] Unexpected error:', e)
  }
}

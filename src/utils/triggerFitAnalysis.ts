import { supabase, supabaseUrl, supabaseAnonKey } from '@/lib/supabaseClient'

export type FitAnalysisStatus = 'ok' | 'deferred' | 'no_job_description'

/**
 * Calls the analyze-candidate-fit function. Uses fetch directly (rather than
 * functions.invoke) so a re-score can be aborted from the UI.
 */
export async function requestFitAnalysis(
  candidateId: string,
  jobId: string,
  signal?: AbortSignal,
): Promise<FitAnalysisStatus> {
  const { data: { session } } = await supabase.auth.getSession()
  const response = await fetch(`${supabaseUrl}/functions/v1/analyze-candidate-fit`, {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      apikey: supabaseAnonKey,
      Authorization: `Bearer ${session?.access_token || supabaseAnonKey}`,
    },
    body: JSON.stringify({ candidate_id: candidateId, job_id: jobId }),
  })

  const payload = await response.json().catch(() => null)

  if (payload?.error === 'no_job_description') return 'no_job_description'
  // 202: the candidate row was just touched and enrichment has not landed yet.
  if (response.status === 202) return 'deferred'
  if (!response.ok) throw new Error(payload?.error || `The assessment failed (${response.status})`)
  return 'ok'
}

/**
 * Triggers the AI fit analysis for a candidate-job pair.
 */
export async function triggerFitAnalysis(candidateId: string, jobId: string): Promise<void> {
  await requestFitAnalysis(candidateId, jobId)
}

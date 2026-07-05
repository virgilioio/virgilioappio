import { supabase } from '@/lib/supabaseClient'

export interface RequestScorecardArgs {
  associationId: string
  jobHiringStageId: string
  interviewerUserIds?: string[] // undefined/empty = every still-pending interviewer
}

export interface RequestScorecardResult {
  ok: boolean
  sent?: number
  skipped?: number
  targeted?: number
  error?: string
}

/**
 * Fires the on-demand "Request scorecard" email via the shared edge function.
 * Reuses the same delivery pipeline as the automated cadence reminders and
 * upserts scorecard_reminder_sends so the UI can render "Requested Xd ago".
 */
export async function requestScorecard(
  args: RequestScorecardArgs,
): Promise<RequestScorecardResult> {
  const { data, error } = await supabase.functions.invoke('request-scorecard', {
    body: {
      association_id: args.associationId,
      job_hiring_stage_id: args.jobHiringStageId,
      interviewer_user_ids: args.interviewerUserIds ?? [],
    },
  })
  if (error) return { ok: false, error: error.message }
  return (data as RequestScorecardResult) || { ok: true }
}

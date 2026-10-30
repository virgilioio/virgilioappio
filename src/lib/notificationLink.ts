import type { NotificationRow } from '@/hooks/useNotifications'

/**
 * Where a bell item opens. Items about a candidate in a job open the in-job
 * profile (a scorecard on its Scorecards tab), even when the item was written
 * with the candidate's general profile; the database writes new items this way
 * (`notifications_a_in_job_link`), this keeps older ones in step.
 */
export function notificationHref(
  n: Pick<NotificationRow, 'action_url' | 'job_id' | 'candidate_id' | 'category'>,
): string | null {
  const url = n.action_url
  if (!url) return null
  const { job_id: job, candidate_id: cand } = n
  if (job && cand && (url === `/candidates/${cand}` || url === `/candidates?openCandidate=${cand}`)) {
    return `/jobs/${job}/candidates/${cand}${n.category === 'scorecard_submitted' ? '?tab=scorecards' : ''}`
  }
  return url
}

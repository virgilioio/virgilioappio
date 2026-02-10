import { supabase } from '@/integrations/supabase/client'

/**
 * Determines if a user role requires job-scoping (restricted to assigned jobs only).
 * Admins, workspace owners, platform admins, and recruiters see all jobs.
 * Hiring managers and interviewers only see assigned jobs.
 */
export function isRestrictedRole(permissions: {
  isAdmin: boolean
  isWorkspaceOwner: boolean
  isPlatformAdmin: boolean
  isRecruiter: boolean
}): boolean {
  return !(permissions.isPlatformAdmin || permissions.isWorkspaceOwner || permissions.isAdmin || permissions.isRecruiter)
}

/**
 * Fetches job IDs assigned to a user via job_assignments table.
 * Returns null if userId is not provided.
 */
export async function fetchAssignedJobIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('job_assignments')
    .select('job_id')
    .eq('user_id', userId)
    .is('deleted_at', null)

  if (error) {
    console.error('[jobScoping] Error fetching assigned jobs:', error)
    return []
  }

  return data?.map(a => a.job_id) || []
}

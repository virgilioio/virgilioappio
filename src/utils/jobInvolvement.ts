import type { Json } from '@/integrations/supabase/types'

/**
 * Extracts user IDs from a hiring_team JSONB field.
 * Handles both string arrays and object arrays with id/user_id properties.
 */
export function extractHiringTeamUserIds(hiringTeam: Json | null | undefined): Set<string> {
  const userIds = new Set<string>()
  
  if (!hiringTeam || !Array.isArray(hiringTeam)) {
    return userIds
  }

  for (const member of hiringTeam) {
    if (typeof member === 'string') {
      // Direct user ID string
      userIds.add(member)
    } else if (member && typeof member === 'object' && !Array.isArray(member)) {
      // Object with id or user_id property
      const obj = member as Record<string, unknown>
      if (typeof obj.id === 'string') {
        userIds.add(obj.id)
      } else if (typeof obj.user_id === 'string') {
        userIds.add(obj.user_id)
      }
    }
  }

  return userIds
}

/**
 * Checks if a job matches any of the selected user IDs.
 * A job matches if any selected user is in the hiring_team OR in the assignedJobIds set.
 */
export function jobMatchesUsers(
  job: { id: string; hiring_team?: Json | null },
  selectedUserIds: string[],
  assignedJobIds: Set<string>
): boolean {
  if (selectedUserIds.length === 0) {
    return true // No filter applied
  }

  // Check if job is in assignedJobIds (user assigned via job_assignments table)
  if (assignedJobIds.has(job.id)) {
    return true
  }

  // Check if any selected user is in hiring_team
  const hiringTeamUserIds = extractHiringTeamUserIds(job.hiring_team)
  return selectedUserIds.some(userId => hiringTeamUserIds.has(userId))
}

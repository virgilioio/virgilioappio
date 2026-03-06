import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

export type JobAssignmentRole = 'recruiter' | 'hiring_manager' | 'interviewer'

interface UserJobAssignment {
  job_id: string
  role: JobAssignmentRole
}

/**
 * Fetches all job assignments for the current user and derives role flags.
 * Used for job-scoped visibility enforcement on members.
 */
export function useUserJobRoles() {
  const { user, userType, memberRole } = useAuth()

  const isPrivileged =
    userType === 'platform_admin' ||
    userType === 'workspace_owner' ||
    (userType === 'member' && memberRole === 'admin')

  const { data: assignments, isLoading } = useQuery({
    queryKey: ['user-job-roles', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_assignments')
        .select('job_id, role')
        .eq('user_id', user!.id)
        .is('deleted_at', null)

      if (error) {
        console.error('[useUserJobRoles] Error fetching assignments:', error)
        throw error
      }

      return (data as UserJobAssignment[]) || []
    },
    enabled: !!user && !isPrivileged,
    staleTime: 1000 * 60 * 2,
  })

  // For privileged users, skip assignment-based filtering entirely
  if (isPrivileged) {
    return {
      assignedJobIds: [] as string[],
      hasRecruiterRole: true,
      hasOnlyRestrictedRoles: false,
      isPrivileged: true,
      isLoading: false,
    }
  }

  const resolved = assignments || []
  const assignedJobIds = resolved.map(a => a.job_id)
  const hasRecruiterRole = resolved.some(a => a.role === 'recruiter')
  const hasOnlyRestrictedRoles =
    resolved.length > 0 && !hasRecruiterRole

  return {
    assignedJobIds,
    hasRecruiterRole,
    hasOnlyRestrictedRoles,
    isPrivileged: false,
    isLoading,
  }
}

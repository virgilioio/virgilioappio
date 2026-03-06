
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

export type JobRole = 'recruiter' | 'hiring_manager' | 'interviewer' | null

/**
 * Returns the current user's role on a specific job via job_assignments.
 * Returns null if the user has no assignment on this job.
 */
export function useJobRole(jobId: string | undefined) {
  const { user } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['job-role', jobId, user?.id],
    queryFn: async (): Promise<JobRole> => {
      if (!jobId || !user?.id) return null

      const { data: assignment, error } = await supabase
        .from('job_assignments')
        .select('role')
        .eq('job_id', jobId)
        .eq('user_id', user.id)
        .is('deleted_at', null)
        .maybeSingle()

      if (error) {
        console.error('[useJobRole] Error:', error)
        return null
      }

      return (assignment?.role as JobRole) ?? null
    },
    enabled: !!jobId && !!user?.id,
    staleTime: 1000 * 60 * 2,
  })

  return {
    jobRole: data ?? null,
    isRecruiterOnJob: data === 'recruiter',
    isHiringManagerOnJob: data === 'hiring_manager',
    isInterviewerOnJob: data === 'interviewer',
    isAssigned: data !== null && data !== undefined,
    isLoading,
  }
}

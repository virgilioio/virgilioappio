import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Fetches user IDs that have at least one recruiter job assignment.
 * Used to determine billable seats: admin OR recruiter = paid seat.
 */
export function useRecruiterUserIds() {
  const { user } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['recruiter-user-ids'],
    queryFn: async () => {
      const { data: assignments, error } = await supabase
        .from('job_assignments')
        .select('user_id')
        .eq('role', 'recruiter')
        .is('deleted_at', null)

      if (error) {
        console.error('[useRecruiterUserIds] Error:', error)
        throw error
      }

      return new Set(assignments?.map(a => a.user_id) || [])
    },
    enabled: !!user,
    staleTime: 1000 * 60 * 2,
  })

  return {
    recruiterUserIds: data ?? new Set<string>(),
    isLoading,
  }
}

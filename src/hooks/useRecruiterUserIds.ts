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
    queryKey: ['recruiter-user-ids', 'v2'],
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

  const ids = data instanceof Set ? data : new Set(Array.isArray(data) ? data : [])

  return {
    recruiterUserIds: ids,
    isLoading,
  }
}

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Fetches job IDs where any of the specified users are assigned via job_assignments table.
 * Returns a Set for O(1) lookup.
 */
export function useUserAssignedJobIds(userIds: string[]) {
  const { user } = useAuth()

  const { data, isLoading } = useQuery({
    queryKey: ['user-assigned-job-ids', userIds.join(',')],
    queryFn: async () => {
      if (userIds.length === 0) {
        return new Set<string>()
      }

      const { data: assignments, error } = await supabase
        .from('job_assignments')
        .select('job_id')
        .in('user_id', userIds)
        .is('deleted_at', null)

      if (error) {
        console.error('[useUserAssignedJobIds] Error fetching assignments:', error)
        throw error
      }

      return new Set(assignments?.map(a => a.job_id) || [])
    },
    enabled: !!user && userIds.length > 0,
    staleTime: 1000 * 60 * 2 // 2 minutes
  })

  return {
    assignedJobIds: data ?? new Set<string>(),
    isLoading: userIds.length > 0 ? isLoading : false
  }
}

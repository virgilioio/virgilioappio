import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export interface MemberJobAssignment {
  id: string
  job_id: string
  role: string
  created_at: string
  job_title: string
  job_status: string
  organization_name?: string
}

export function useMemberJobAssignments(userId: string | null | undefined) {
  return useQuery({
    queryKey: ['member-job-assignments', userId],
    queryFn: async (): Promise<MemberJobAssignment[]> => {
      if (!userId) return []

      const { data, error } = await supabase
        .from('job_assignments')
        .select(`
          id,
          job_id,
          role,
          created_at,
          jobs!job_assignments_job_id_fkey (
            title,
            status,
            organizations ( name )
          )
        `)
        .eq('user_id', userId)
        .is('deleted_at', null)

      if (error) {
        console.error('Error fetching member job assignments:', error)
        return []
      }

      return (data || []).map((a: any) => ({
        id: a.id,
        job_id: a.job_id,
        role: a.role,
        created_at: a.created_at,
        job_title: a.jobs?.title || 'Unknown Job',
        job_status: a.jobs?.status || 'unknown',
        organization_name: a.jobs?.organizations?.name,
      }))
    },
    enabled: !!userId,
  })
}

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

/**
 * Whether you see this job's offers: admins, the job's Recruiter and Hiring
 * manager (and, per offer, its approvers). The database decides through
 * can_view_job_offers; this only chooses what the screen shows. Without a job
 * (the standalone profile) the offers themselves are filtered by the database.
 */
export function useCanViewOffers(jobId: string | null | undefined) {
  const { user } = useAuth()
  const { data, isLoading } = useQuery({
    queryKey: ['can-view-offers', jobId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('can_view_job_offers', { _job_id: jobId! })
      if (error) throw error
      return data === true
    },
    enabled: !!jobId && !!user?.id,
    staleTime: 1000 * 60 * 2,
  })
  if (!jobId) return { canViewOffers: true, isLoading: false }
  return { canViewOffers: data === true, isLoading }
}

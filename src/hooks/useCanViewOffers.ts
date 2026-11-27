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

/**
 * Whether you approve an offer for this candidate on this job (2026-11-27). An
 * approver outside the offer team (a Sourcer, an interviewer) still has a step
 * to decide: the profile shows them the Offer tab to read the offer and decide
 * it, without creating, editing, sending or reminding. The database lets
 * approvers read the request, its steps and the offer (offer_approval_is_approver,
 * offer_letter_is_approver); this only reads their own steps.
 */
export function useIsOfferApprover(jobId: string | null | undefined, candidateId: string | null | undefined) {
  const { user } = useAuth()
  const { data, isPending } = useQuery({
    queryKey: ['is-offer-approver', jobId, candidateId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('offer_approval_request_steps')
        .select('id, offer_approval_requests!inner(job_id, candidate_id)')
        .eq('approver_user_id', user!.id)
        .eq('offer_approval_requests.job_id', jobId!)
        .eq('offer_approval_requests.candidate_id', candidateId!)
        .limit(1)
      if (error) throw error
      return (data ?? []).length > 0
    },
    enabled: !!jobId && !!candidateId && !!user?.id,
    staleTime: 1000 * 60,
  })
  // Pending until it has answered (also while it waits for the signed-in user), so a link
  // to the approval isn't sent back to Job overview before we know.
  return { isOfferApprover: data === true, isLoading: !!jobId && !!candidateId && isPending }
}

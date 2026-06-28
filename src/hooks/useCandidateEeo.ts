import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { usePermissions } from '@/hooks/usePermissions'
import type {
  EeoGender,
  EeoRaceEthnicity,
  EeoVeteranStatus,
  EeoDisabilityStatus,
} from '@/lib/eeo'

/**
 * Returns true only for platform admins, workspace owners, and members with
 * the system role "admin". Recruiters, hiring managers, interviewers, sales,
 * and regular members are explicitly excluded — they must never see EEO data.
 */
export function useCanViewEeo(): boolean {
  const { isPlatformAdmin, isWorkspaceOwner, isAdmin } = usePermissions()
  return Boolean(isPlatformAdmin || isWorkspaceOwner || isAdmin)
}

export interface CandidateEeoResponse {
  id: string
  candidate_id: string
  tenant_id: string
  job_posting_id: string | null
  gender: EeoGender | null
  race_ethnicity: EeoRaceEthnicity | null
  veteran_status: EeoVeteranStatus | null
  disability_status: EeoDisabilityStatus | null
  submitted_at: string
}

export function useCandidateEeoResponse(candidateId: string | null | undefined) {
  const canView = useCanViewEeo()

  return useQuery({
    queryKey: ['candidate-eeo-response', candidateId],
    enabled: !!candidateId && canView,
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('candidate_eeo_responses' as any)
        .select('id, candidate_id, tenant_id, job_posting_id, gender, race_ethnicity, veteran_status, disability_status, submitted_at')
        .eq('candidate_id', candidateId!)
        .maybeSingle()
      if (error) {
        console.error('[useCandidateEeoResponse] fetch error:', error)
        return null
      }
      return (data as unknown as CandidateEeoResponse) || null
    },
  })
}

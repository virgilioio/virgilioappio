import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export interface SavedCandidate {
  id: string
  candidate_name: string
  email?: string | null
  phone?: string | null
  linkedin_url?: string | null
  location_city?: string | null
  location_state?: string | null
  location_country?: string | null
  company_current?: string | null
  role_current?: string | null
  apollo_collected_at: string
  apollo_id?: string | null
  job_associations: Array<{
    job_id: string
    job_title: string
    stage_name?: string
    /** Gio Fit for this job, once scored. */
    gio_fit?: number | null
  }>
}

interface UseSavedCandidatesOptions {
  projectId: string | null
  enabled?: boolean
  status?: 'active' | 'archived'
}

export function useSavedCandidates({ projectId, enabled = true, status = 'active' }: UseSavedCandidatesOptions) {
  return useQuery({
    queryKey: [status === 'active' ? 'saved-candidates' : 'archived-candidates', projectId],
    queryFn: async (): Promise<SavedCandidate[]> => {
      if (!projectId) return []

      // Step 1: who this project collected, from its state table (kept
      // across search refreshes; 2026-10-11)
      const { data: stateRows, error: stateError } = await supabase
        .from('sourcing_project_candidates')
        .select('candidate_id, apollo_id, collected_at')
        .eq('sourcing_project_id', projectId)
        .in('status', status === 'active' ? ['active', 'shortlisted'] : ['archived'])
        .not('collected_at', 'is', null)
        .not('candidate_id', 'is', null)

      if (stateError) throw stateError
      const candidateIdsFromState = (stateRows || [])
        .map(r => r.candidate_id)
        .filter((id): id is string => !!id)
      if (candidateIdsFromState.length === 0) return []

      // Step 2: the candidates themselves (people since removed drop out)
      const { data: candidates, error: candidatesError } = await supabase
        .from('candidates')
        .select(`
          id,
          candidate_name,
          email,
          phone,
          linkedin_url,
          location_city,
          location_state,
          location_country,
          company_current,
          role_current,
          apollo_collected_at,
          apollo_id
        `)
        .in('id', candidateIdsFromState)
        .order('apollo_collected_at', { ascending: false })

      if (candidatesError) {
        console.error('Error fetching candidates:', candidatesError)
        throw candidatesError
      }

      if (!candidates || candidates.length === 0) {
        return []
      }

      // Step 3: Get job associations for these candidates
      const candidateIds = candidates.map(c => c.id)
      
      const { data: associations, error: associationsError } = await supabase
        .from('job_candidate_associations')
        .select(`
          candidate_id,
          job_id,
          ai_fit_score,
          jobs:job_id (
            id,
            title
          ),
          job_hiring_stages:current_stage_id (
            id,
            job_stages:stage_id (
              stage_name
            )
          )
        `)
        .in('candidate_id', candidateIds)

      if (associationsError) {
        console.error('Error fetching associations:', associationsError)
        // Don't throw, just proceed without associations
      }

      // Step 4: Map job associations to candidates
      const associationMap = new Map<string, SavedCandidate['job_associations']>()
      
      if (associations) {
        for (const assoc of associations) {
          const candidateId = assoc.candidate_id
          const job = assoc.jobs as any
          const stage = assoc.job_hiring_stages as any
          
          if (!associationMap.has(candidateId)) {
            associationMap.set(candidateId, [])
          }
          
          if (job) {
            associationMap.get(candidateId)!.push({
              job_id: job.id,
              job_title: job.title,
              stage_name: stage?.job_stages?.stage_name,
              gio_fit: typeof (assoc as { ai_fit_score?: unknown }).ai_fit_score === 'number' ? (assoc as { ai_fit_score: number }).ai_fit_score : null,
            })
          }
        }
      }

      // Step 5: Combine and return
      return candidates.map(candidate => ({
        id: candidate.id,
        candidate_name: candidate.candidate_name,
        email: candidate.email,
        phone: candidate.phone,
        linkedin_url: candidate.linkedin_url,
        location_city: candidate.location_city,
        location_state: candidate.location_state,
        location_country: candidate.location_country,
        company_current: candidate.company_current,
        role_current: candidate.role_current,
        apollo_collected_at: candidate.apollo_collected_at!,
        apollo_id: candidate.apollo_id,
        job_associations: associationMap.get(candidate.id) || []
      }))
    },
    enabled: enabled && !!projectId,
    staleTime: 30000, // 30 seconds
  })
}

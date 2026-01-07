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

      // Step 1: Get all apollo_ids from preview candidates that were ACTUALLY collected in this project
      const { data: previewCandidates, error: previewError } = await supabase
        .from('sourcing_preview_candidates')
        .select('apollo_id')
        .eq('sourcing_project_id', projectId)
        .eq('status', status)
        .not('apollo_id', 'is', null)
        .not('collected_at', 'is', null)  // Only include candidates actually collected in THIS project

      if (previewError) {
        console.error('Error fetching preview candidates:', previewError)
        throw previewError
      }

      if (!previewCandidates || previewCandidates.length === 0) {
        return []
      }

      const apolloIds = previewCandidates
        .map(pc => pc.apollo_id)
        .filter((id): id is string => id !== null)

      if (apolloIds.length === 0) return []

      // Step 2: Get collected candidates that match these apollo_ids
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
        .in('apollo_id', apolloIds)
        .not('apollo_collected_at', 'is', null)
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
              stage_name: stage?.job_stages?.stage_name
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

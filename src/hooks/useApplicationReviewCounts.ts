import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useJobs } from '@/hooks/useJobs'

export interface ApplicationReviewCount {
  jobId: string
  jobTitle: string
  count: number
}

export function useApplicationReviewCounts() {
  const { jobs, isLoading: jobsLoading } = useJobs()

  const jobIds = jobs?.map(j => j.id) ?? []

  return useQuery({
    queryKey: ['application-review-counts', jobIds],
    enabled: jobIds.length > 0 && !jobsLoading,
    staleTime: 30_000,
    queryFn: async (): Promise<ApplicationReviewCount[]> => {
      // Step 1: Get job_hiring_stages with stage_type = 'application_review'
      const chunkSize = 200
      const allHiringStages: { id: string; job_id: string }[] = []

      for (let i = 0; i < jobIds.length; i += chunkSize) {
        const chunk = jobIds.slice(i, i + chunkSize)
        const { data, error } = await supabase
          .from('job_hiring_stages')
          .select('id, job_id, job_stages!job_hiring_stages_stage_id_fkey(stage_type)')
          .in('job_id', chunk)

        if (error) {
          console.error('Error fetching hiring stages:', error)
          continue
        }

        const filtered = (data ?? []).filter(
          (row: any) => row.job_stages?.stage_type === 'application_review'
        )
        allHiringStages.push(...filtered.map((r: any) => ({ id: r.id, job_id: r.job_id })))
      }

      if (allHiringStages.length === 0) return []

      const stageIds = allHiringStages.map(s => s.id)
      const stageToJob = new Map(allHiringStages.map(s => [s.id, s.job_id]))

      // Step 2: Count active associations at those stages
      const allAssociations: { current_stage_id: string }[] = []

      for (let i = 0; i < stageIds.length; i += chunkSize) {
        const chunk = stageIds.slice(i, i + chunkSize)
        const { data, error } = await supabase
          .from('job_candidate_associations')
          .select('current_stage_id')
          .in('current_stage_id', chunk)
          .eq('status', 'active')

        if (error) {
          console.error('Error fetching associations:', error)
          continue
        }
        if (data) allAssociations.push(...data)
      }

      // Group by job
      const countMap = new Map<string, number>()
      for (const a of allAssociations) {
        const jobId = stageToJob.get(a.current_stage_id)
        if (jobId) countMap.set(jobId, (countMap.get(jobId) ?? 0) + 1)
      }

      // Build result with job titles
      const jobTitleMap = new Map(jobs?.map(j => [j.id, j.title]) ?? [])
      const results: ApplicationReviewCount[] = []
      for (const [jobId, count] of countMap) {
        results.push({
          jobId,
          jobTitle: jobTitleMap.get(jobId) ?? 'Unknown Job',
          count,
        })
      }

      return results.sort((a, b) => b.count - a.count)
    },
  })
}

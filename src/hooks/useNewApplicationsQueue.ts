import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useJobs } from '@/hooks/useJobs'

export interface NewApplicationItem {
  associationId: string
  candidateId: string
  candidateName: string
  jobId: string
  jobTitle: string
  enteredAt: string
  source: string | null
}

/**
 * Candidates currently sitting in any `application_review` stage.
 * One row per candidate (not per job), used by the dashboard queue.
 */
export function useNewApplicationsQueue() {
  const { jobs, isLoading: jobsLoading } = useJobs()
  const jobIds = jobs?.map(j => j.id) ?? []

  return useQuery({
    queryKey: ['new-applications-queue', jobIds],
    enabled: !jobsLoading && jobIds.length > 0,
    staleTime: 30_000,
    queryFn: async (): Promise<NewApplicationItem[]> => {
      const chunkSize = 40
      const hiringStages: { id: string; job_id: string }[] = []
      for (let i = 0; i < jobIds.length; i += chunkSize) {
        const chunk = jobIds.slice(i, i + chunkSize)
        const { data, error } = await supabase
          .from('job_hiring_stages')
          .select('id, job_id, job_stages!job_hiring_stages_stage_id_fkey(stage_type)')
          .in('job_id', chunk)
        if (error) continue
        const filtered = (data ?? []).filter(
          (r: any) => r.job_stages?.stage_type === 'application_review',
        )
        hiringStages.push(...filtered.map((r: any) => ({ id: r.id, job_id: r.job_id })))
      }
      if (hiringStages.length === 0) return []

      const stageIds = hiringStages.map(s => s.id)
      const stageToJob = new Map(hiringStages.map(s => [s.id, s.job_id]))
      const jobMap = new Map(jobs?.map(j => [j.id, j]) ?? [])

      const items: NewApplicationItem[] = []
      for (let i = 0; i < stageIds.length; i += chunkSize) {
        const chunk = stageIds.slice(i, i + chunkSize)
        const { data, error } = await supabase
          .from('job_candidate_associations')
          .select(`
            id,
            candidate_id,
            current_stage_id,
            entered_stage_at,
            created_at,
            source,
            candidates!inner(id, candidate_name)
          `)
          .in('current_stage_id', chunk)
          .eq('status', 'active')
          .order('entered_stage_at', { ascending: false })
        if (error || !data) continue
        for (const row of data as any[]) {
          const jobId = stageToJob.get(row.current_stage_id)
          if (!jobId) continue
          const job = jobMap.get(jobId)
          items.push({
            associationId: row.id,
            candidateId: row.candidate_id,
            candidateName: row.candidates?.candidate_name ?? 'Unknown',
            jobId,
            jobTitle: job?.title ?? 'Unknown Job',
            enteredAt: row.entered_stage_at ?? row.created_at,
            source: row.source ?? null,
          })
        }
      }
      // newest in queue first
      return items.sort(
        (a, b) => new Date(b.enteredAt).getTime() - new Date(a.enteredAt).getTime(),
      )
    },
  })
}

import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export interface JobSourcingProjectSummary {
  id: string
  name: string
  total_candidates: number | null
  updated_at: string
}

export function useJobSourcingProject(jobId: string | undefined) {
  const query = useQuery({
    queryKey: ['job-sourcing-project', jobId],
    queryFn: async (): Promise<JobSourcingProjectSummary[]> => {
      if (!jobId) return []

      const { data, error } = await supabase
        .from('sourcing_projects')
        .select('id, name, total_candidates, updated_at')
        .eq('job_id', jobId)
        .eq('status', 'active')
        .order('updated_at', { ascending: false })

      if (error) throw error
      return (data ?? []) as JobSourcingProjectSummary[]
    },
    enabled: !!jobId,
  })

  const projects = query.data ?? []
  const first = projects[0] ?? null

  return {
    projects,
    sourcingProjectId: first?.id ?? null,
    sourcingProjectName: first?.name ?? null,
    isLoading: query.isLoading,
  }
}

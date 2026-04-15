import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export function useJobSourcingProject(jobId: string | undefined) {
  const query = useQuery({
    queryKey: ['job-sourcing-project', jobId],
    queryFn: async () => {
      if (!jobId) return null

      const { data, error } = await supabase
        .from('sourcing_projects')
        .select('id, name')
        .eq('job_id', jobId)
        .eq('status', 'active')
        .maybeSingle()

      if (error) throw error
      return data
    },
    enabled: !!jobId,
  })

  return {
    sourcingProjectId: query.data?.id ?? null,
    sourcingProjectName: query.data?.name ?? null,
    isLoading: query.isLoading,
  }
}

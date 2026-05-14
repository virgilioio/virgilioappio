import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

/**
 * Returns a map of jobId -> total active candidate count, used to render the
 * Pipeline column on the Jobs list page. Single grouped query.
 */
export function useJobsCandidateCounts(jobIds: string[]) {
  const key = jobIds.slice().sort().join(',')
  return useQuery({
    queryKey: ['jobs-candidate-counts', key],
    enabled: jobIds.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('job_candidate_associations')
        .select('job_id, status')
        .in('job_id', jobIds)
        .eq('status', 'active')
      if (error) throw error
      const map: Record<string, number> = {}
      for (const id of jobIds) map[id] = 0
      for (const row of data || []) {
        map[(row as any).job_id] = (map[(row as any).job_id] || 0) + 1
      }
      return map
    },
  })
}

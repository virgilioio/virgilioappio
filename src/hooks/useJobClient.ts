import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

/** The client (organization) a job belongs to — used as reference-check provenance. */
export function useJobClient(jobId?: string | null) {
  const query = useQuery({
    queryKey: ['job-client', jobId],
    enabled: !!jobId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('jobs')
        .select('organization_id, organizations(id, name)')
        .eq('id', jobId!)
        .maybeSingle()
      if (error) throw error
      const org = (data as any)?.organizations
      return {
        clientId: (data as any)?.organization_id ?? null,
        clientName: org?.name ?? null,
      }
    },
  })

  return {
    clientId: query.data?.clientId ?? null,
    clientName: query.data?.clientName ?? null,
  }
}

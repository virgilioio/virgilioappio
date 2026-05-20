import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useTenant } from '@/hooks/useTenant'

export interface CandidateKpis {
  total: number
  inActivePipeline: number
  awaitingOutreach: number
  favorites: number
  newThisWeek: number
}

const EMPTY: CandidateKpis = {
  total: 0,
  inActivePipeline: 0,
  awaitingOutreach: 0,
  favorites: 0,
  newThisWeek: 0,
}

export function useCandidateKpis() {
  const { tenant } = useTenant()
  return useQuery<CandidateKpis>({
    queryKey: ['candidate-kpis', tenant?.id],
    enabled: !!tenant?.id,
    staleTime: 60_000,
    queryFn: async () => {
      if (!tenant?.id) return EMPTY
      const { data, error } = await (supabase as any).rpc('get_candidate_kpis', { _tenant_id: tenant.id })
      if (error) {
        console.error('get_candidate_kpis failed', error)
        return EMPTY
      }
      const row = Array.isArray(data) ? data[0] : data
      if (!row) return EMPTY
      return {
        total: Number(row.total ?? 0),
        inActivePipeline: Number(row.in_active_pipeline ?? 0),
        awaitingOutreach: Number(row.awaiting_outreach ?? 0),
        favorites: Number(row.favorites ?? 0),
        newThisWeek: Number(row.new_this_week ?? 0),
      }
    },
  })
}

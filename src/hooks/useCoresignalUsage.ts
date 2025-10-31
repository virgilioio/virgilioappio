import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/contexts/AuthContext'
import { supabase } from '@/lib/supabaseClient'

export interface CoresignalUsage {
  organization_id: string
  month: string
  search_credits_used: number
  collect_credits_used: number
  search_credits_limit: number
  collect_credits_limit: number
  created_at: string
  updated_at: string
}

export function useCoresignalUsage() {
  const { organizationId } = useAuth()
  const currentMonth = new Date().toISOString().slice(0, 7) + '-01'

  return useQuery<CoresignalUsage | null>({
    queryKey: ['coresignal-usage', organizationId, currentMonth],
    queryFn: async () => {
      if (!organizationId) return null

      const { data, error } = await supabase
        .from('coresignal_usage')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('month', currentMonth)
        .maybeSingle()

      if (error && error.code !== 'PGRST116') {
        throw error
      }

      // If no record exists, create one
      if (!data) {
        const { data: newRecord, error: insertError } = await supabase
          .from('coresignal_usage')
          .insert({
            organization_id: organizationId,
            month: currentMonth,
            search_credits_limit: 500,
            collect_credits_limit: 250
          })
          .select()
          .single()

        if (insertError) throw insertError
        return newRecord
      }

      return data
    },
    enabled: !!organizationId,
    refetchInterval: 30000, // Refresh every 30s
    staleTime: 10000
  })
}

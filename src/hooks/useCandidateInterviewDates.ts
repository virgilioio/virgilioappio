import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useTenant } from '@/hooks/useTenant'

/**
 * Interview dates per candidate, for the Candidates page's Interview filter
 * and sort (2026-10-14): every booking with a candidate that wasn't cancelled
 * and wasn't a no-show, past or upcoming. Loaded only when a filter or sort
 * needs it; RLS keeps it to the workspace's bookings.
 */
export function useCandidateInterviewDates(enabled: boolean) {
  const { tenant } = useTenant()
  const query = useQuery({
    queryKey: ['candidate-interview-dates', tenant?.id],
    enabled: enabled && !!tenant?.id,
    staleTime: 60_000,
    queryFn: async () => {
      const map = new Map<string, number[]>()
      const PAGE = 1000
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await supabase
          .from('scheduled_bookings')
          .select('id, candidate_id, scheduled_start')
          .not('candidate_id', 'is', null)
          .not('status', 'in', '(cancelled,no_show)')
          .order('id')
          .range(from, from + PAGE - 1)
        if (error) throw error
        for (const row of data ?? []) {
          const t = row.scheduled_start ? new Date(row.scheduled_start).getTime() : NaN
          if (!row.candidate_id || Number.isNaN(t)) continue
          const list = map.get(row.candidate_id)
          if (list) list.push(t)
          else map.set(row.candidate_id, [t])
        }
        if (!data || data.length < PAGE) break
      }
      return map
    },
  })
  return { interviewsMap: query.data, isLoading: enabled && query.isLoading, error: query.error }
}

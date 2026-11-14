import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'

/**
 * What you finished today (queue_done_today, Mexico City day): candidates moved or
 * rejected, scorecards submitted, emails sent to candidates, offers decided and
 * conversations marked done. Null until it's known, so the header never says 0 early.
 */
export function useQueueDoneToday(): number | null {
  const { user } = useAuth()
  const { data } = useQuery({
    queryKey: ['queue-done-today', user?.id],
    enabled: !!user?.id,
    staleTime: 60_000,
    refetchInterval: 5 * 60_000,
    queryFn: async () => {
      const rpc = supabase.rpc.bind(supabase) as unknown as (fn: string) => Promise<{ data: number | null; error: unknown }>
      const { data, error } = await rpc('queue_done_today')
      if (error) return null
      return typeof data === 'number' ? data : null
    },
  })
  return data ?? null
}

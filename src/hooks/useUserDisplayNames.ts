import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

/**
 * Resolve display names for a set of auth user ids using public.profiles.
 * Falls back to the email local-part when no name is stored.
 */
export function useUserDisplayNames(userIds: (string | null | undefined)[]) {
  const ids = Array.from(new Set(userIds.filter((id): id is string => !!id))).sort()

  const { data = {}, isLoading } = useQuery<Record<string, string>>({
    queryKey: ['user-display-names', ids],
    enabled: ids.length > 0,
    staleTime: 10 * 60_000,
    gcTime: 30 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('user_id, first_name, last_name, email')
        .in('user_id', ids)
      if (error) throw error
      const map: Record<string, string> = {}
      for (const p of data || []) {
        const full = [p.first_name, p.last_name].filter(Boolean).join(' ').trim()
        const label = full || (p.email ? p.email.split('@')[0] : '')
        if (p.user_id && label) map[p.user_id] = label
      }
      return map
    },
  })

  return {
    names: data,
    isLoading,
    getName: (id?: string | null) => (id ? data[id] || null : null),
  }
}

/** Convenience single-id variant. */
export function useUserDisplayName(userId?: string | null) {
  const { getName, isLoading } = useUserDisplayNames([userId])
  return { name: getName(userId), isLoading }
}

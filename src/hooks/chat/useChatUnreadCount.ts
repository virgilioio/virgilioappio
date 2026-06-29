import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useTenant } from '@/hooks/useTenant'
import { useAuth } from '@/contexts/AuthContext'
import { useCanUseChat } from '@/hooks/usePermissions'

/**
 * useChatUnreadCount — per-recruiter unread thread count (Step 1.9 hardening).
 *
 * Compares each thread's `last_message_at` against this user's own row in
 * `chat_thread_reads` so two recruiters don't clear each other's badge.
 */
export function useChatUnreadCount() {
  const { tenant } = useTenant()
  const { user } = useAuth()
  const canUseChat = useCanUseChat()
  const tenantId = tenant?.id
  const userId = user?.id

  return useQuery({
    queryKey: ['chat-unread-count', tenantId, userId],
    enabled: Boolean(tenantId && userId && canUseChat),
    staleTime: 15_000,
    queryFn: async (): Promise<number> => {
      if (!tenantId || !userId) return 0

      const [threadsRes, readsRes] = await Promise.all([
        supabase
          .from('chat_threads')
          .select('id, last_message_at')
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .not('last_message_at', 'is', null)
          .limit(500),
        supabase
          .from('chat_thread_reads')
          .select('thread_id, last_read_at')
          .eq('user_id', userId)
          .eq('tenant_id', tenantId),
      ])

      if (threadsRes.error) throw threadsRes.error
      if (readsRes.error) throw readsRes.error

      const reads = new Map<string, number>()
      for (const r of readsRes.data ?? []) {
        reads.set(r.thread_id as string, new Date(r.last_read_at as string).getTime())
      }

      return (threadsRes.data ?? []).reduce((acc, row: any) => {
        const last = row.last_message_at ? new Date(row.last_message_at).getTime() : 0
        const read = reads.get(row.id) ?? 0
        return acc + (last > 0 && last > read ? 1 : 0)
      }, 0)
    },
  })
}

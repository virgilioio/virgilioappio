import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useTenant } from '@/hooks/useTenant'
import { useAuth } from '@/contexts/AuthContext'
import { useCanUseChat } from '@/hooks/usePermissions'

/**
 * useChatUnreadCount — number of threads in tenant with unread inbound activity
 * since the recruiter's last read marker (Step 1.9).
 *
 * Lightweight client-side count over open threads; refreshed via realtime
 * invalidation from `useChatRealtime`.
 */
export function useChatUnreadCount() {
  const { tenant } = useTenant()
  const { user } = useAuth()
  const canUseChat = useCanUseChat()
  const tenantId = tenant?.id

  return useQuery({
    queryKey: ['chat-unread-count', tenantId, user?.id],
    enabled: Boolean(tenantId && user?.id && canUseChat),
    staleTime: 15_000,
    queryFn: async (): Promise<number> => {
      if (!tenantId) return 0
      const { data, error } = await supabase
        .from('chat_threads')
        .select('id, last_message_at, last_recruiter_read_at')
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .not('last_message_at', 'is', null)
        .limit(500)

      if (error) throw error

      return (data ?? []).reduce((acc, row: any) => {
        const last = row.last_message_at ? new Date(row.last_message_at).getTime() : 0
        const read = row.last_recruiter_read_at
          ? new Date(row.last_recruiter_read_at).getTime()
          : 0
        return acc + (last > 0 && last > read ? 1 : 0)
      }, 0)
    },
  })
}

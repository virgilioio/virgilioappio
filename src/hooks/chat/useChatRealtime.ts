import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useTenant } from '@/hooks/useTenant'

interface UseChatRealtimeOptions {
  /** Currently open thread — subscribed at finer granularity for fast message delivery. */
  activeThreadId?: string
}

/**
 * useChatRealtime — subscribes to tenant inbox + active thread (Step 1.9).
 *
 * - Inbox channel: any chat_threads change in the tenant invalidates the list
 *   and unread count. INSERT on chat_messages also pokes the list (preview /
 *   counters update).
 * - Thread channel: INSERT on chat_messages for the active thread invalidates
 *   the per-thread message cache, surfacing new messages within ~1s.
 */
export function useChatRealtime({ activeThreadId }: UseChatRealtimeOptions = {}) {
  const queryClient = useQueryClient()
  const { tenant } = useTenant()
  const tenantId = tenant?.id

  // Tenant inbox channel — threads + new messages anywhere in tenant.
  useEffect(() => {
    if (!tenantId) return
    const channel = supabase
      .channel(`chat:inbox:${tenantId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_threads',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chat-threads'] })
          queryClient.invalidateQueries({ queryKey: ['chat-unread-count'] })
        },
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `tenant_id=eq.${tenantId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chat-threads'] })
          queryClient.invalidateQueries({ queryKey: ['chat-unread-count'] })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenantId, queryClient])

  // Active-thread channel — fast message delivery for the open conversation.
  useEffect(() => {
    if (!activeThreadId) return
    const channel = supabase
      .channel(`chat:thread:${activeThreadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `thread_id=eq.${activeThreadId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chat-messages', activeThreadId] })
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeThreadId, queryClient])
}

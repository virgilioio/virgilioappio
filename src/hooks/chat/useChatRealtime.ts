import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useTenant } from '@/hooks/useTenant'

interface UseChatRealtimeOptions {
  /** Currently open thread — subscribed at finer granularity for fast message delivery. */
  activeThreadId?: string
}

/**
 * chat_messages is a partitioned table. Supabase Realtime publishes each
 * monthly partition individually (e.g. `chat_messages_2026_07`), so
 * `postgres_changes` filters on the parent table name receive nothing.
 * We subscribe to the current and next partition names to guarantee delivery
 * across month boundaries.
 */
function chatMessagePartitionNames(date = new Date()): string[] {
  const names: string[] = []
  for (let i = 0; i < 2; i++) {
    const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + i, 1))
    const y = d.getUTCFullYear()
    const m = String(d.getUTCMonth() + 1).padStart(2, '0')
    names.push(`chat_messages_${y}_${m}`)
  }
  return names
}

/**
 * useChatRealtime — subscribes to tenant inbox + active thread (Step 1.9).
 */
export function useChatRealtime({ activeThreadId }: UseChatRealtimeOptions = {}) {
  const queryClient = useQueryClient()
  const { tenant } = useTenant()
  const tenantId = tenant?.id

  // Tenant inbox channel — threads + new messages anywhere in tenant.
  useEffect(() => {
    if (!tenantId) return
    const partitions = chatMessagePartitionNames()
    const channel = supabase.channel(`chat:inbox:${tenantId}`)

    channel.on(
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

    for (const table of partitions) {
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table,
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload: any) => {
          queryClient.invalidateQueries({ queryKey: ['chat-threads'] })
          queryClient.invalidateQueries({ queryKey: ['chat-unread-count'] })
          const threadId = payload?.new?.thread_id
          if (threadId) {
            queryClient.invalidateQueries({ queryKey: ['chat-messages', threadId] })
          }
        },
      )
    }

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [tenantId, queryClient])

  // Active-thread channel — fast message delivery for the open conversation.
  useEffect(() => {
    if (!activeThreadId) return
    const partitions = chatMessagePartitionNames()
    const channel = supabase.channel(`chat:thread:${activeThreadId}`)

    for (const table of partitions) {
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table,
          filter: `thread_id=eq.${activeThreadId}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['chat-messages', activeThreadId] })
        },
      )
    }

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeThreadId, queryClient])
}


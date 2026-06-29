import { useInfiniteQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'

export type ChatDirection = 'in' | 'out' | 'note'
export type ChatSenderType = 'candidate' | 'recruiter' | 'ai' | 'system'

export interface ChatMessageRow {
  id: string
  thread_id: string
  tenant_id: string
  direction: ChatDirection
  sender_type: ChatSenderType
  sender_user_id: string | null
  body: string | null
  parts: any
  read_by_recipient_at: string | null
  redacted_at: string | null
  created_at: string
  /** Optimistic flag for client-only messages */
  _optimistic?: boolean
}

const PAGE_SIZE = 30

/**
 * useChatMessages — cursor-paginated messages for a single thread (Step 1.6).
 * Returns oldest-first within each page; flatten via `data.pages`.
 */
export function useChatMessages(threadId: string | undefined) {
  return useInfiniteQuery({
    queryKey: ['chat-messages', threadId],
    enabled: Boolean(threadId),
    initialPageParam: null as string | null,
    staleTime: 15_000,
    queryFn: async ({ pageParam }): Promise<ChatMessageRow[]> => {
      if (!threadId) return []
      let q = supabase
        .from('chat_messages')
        .select(
          'id, thread_id, tenant_id, direction, sender_type, sender_user_id, body, parts, read_by_recipient_at, redacted_at, created_at',
        )
        .eq('thread_id', threadId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE)
      if (pageParam) q = q.lt('created_at', pageParam)
      const { data, error } = await q
      if (error) throw error
      // Return ascending so render order is natural
      return (data ?? []).slice().reverse() as ChatMessageRow[]
    },
    getNextPageParam: (firstPage, allPages) => {
      const oldest = allPages.flat()[0]
      if (!oldest) return undefined
      // If the most recently fetched page was full, there may be more.
      return firstPage.length === PAGE_SIZE ? oldest.created_at : undefined
    },
  })
}

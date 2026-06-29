import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/hooks/useTenant'
import type { ChatDirection, ChatMessageRow } from '@/hooks/chat/useChatMessages'

interface SendArgs {
  threadId: string
  body: string
  direction?: Exclude<ChatDirection, 'in'>
}

/**
 * useSendChatMessage — optimistic recruiter send / internal note (Step 1.6).
 * Wires into the same react-query cache used by useChatMessages.
 */
export function useSendChatMessage() {
  const { user } = useAuth()
  const { tenant } = useTenant()
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async ({ threadId, body, direction = 'out' }: SendArgs) => {
      if (!tenant?.id || !user?.id) throw new Error('Not authenticated')
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: threadId,
          tenant_id: tenant.id,
          direction,
          sender_type: 'recruiter',
          sender_user_id: user.id,
          body,
        })
        .select()
        .single()
      if (error) throw error
      return data as ChatMessageRow
    },
    onMutate: async ({ threadId, body, direction = 'out' }) => {
      await qc.cancelQueries({ queryKey: ['chat-messages', threadId] })
      const key = ['chat-messages', threadId]
      const prev = qc.getQueryData<InfiniteData<ChatMessageRow[]>>(key)
      const optimistic: ChatMessageRow = {
        id: `optimistic-${crypto.randomUUID()}`,
        thread_id: threadId,
        tenant_id: tenant?.id ?? '',
        direction,
        sender_type: 'recruiter',
        sender_user_id: user?.id ?? null,
        body,
        parts: null,
        read_by_recipient_at: null,
        redacted_at: null,
        created_at: new Date().toISOString(),
        _optimistic: true,
      }
      if (prev) {
        const pages = prev.pages.slice()
        const last = pages[pages.length - 1] ?? []
        pages[pages.length - 1] = [...last, optimistic]
        qc.setQueryData<InfiniteData<ChatMessageRow[]>>(key, { ...prev, pages })
      } else {
        qc.setQueryData<InfiniteData<ChatMessageRow[]>>(key, {
          pages: [[optimistic]],
          pageParams: [null],
        })
      }
      return { prev, optimisticId: optimistic.id }
    },
    onError: (_err, vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(['chat-messages', vars.threadId], ctx.prev)
    },
    onSuccess: (saved, vars, ctx) => {
      const key = ['chat-messages', vars.threadId]
      const cur = qc.getQueryData<InfiniteData<ChatMessageRow[]>>(key)
      if (!cur || !ctx) return
      const pages = cur.pages.map((page) =>
        page.map((m) => (m.id === ctx.optimisticId ? saved : m)),
      )
      qc.setQueryData<InfiniteData<ChatMessageRow[]>>(key, { ...cur, pages })
      qc.invalidateQueries({ queryKey: ['chat-threads'] })
    },
  })
}

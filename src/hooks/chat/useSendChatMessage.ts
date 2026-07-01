import { useMutation, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/hooks/useTenant'
import type { ChatDirection, ChatMessageRow } from '@/hooks/chat/useChatMessages'
import { logChatAuditEvent } from '@/lib/chat/audit'

interface SendArgs {
  threadId: string
  body: string
  direction?: Exclude<ChatDirection, 'in'>
  /** Convenience flag — overrides `direction` to 'note' when true. */
  isInternalNote?: boolean
  /** Optional structured payload (e.g. booking-link card). Written to `parts`. */
  parts?: Record<string, unknown> | null
}

function resolveDirection(args: SendArgs): Exclude<ChatDirection, 'in'> {
  if (args.isInternalNote) return 'note'
  return args.direction ?? 'out'
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
    mutationFn: async (args: SendArgs) => {
      if (!tenant?.id || !user?.id) throw new Error('Not authenticated')
      const direction = resolveDirection(args)

      // Phase 5.1: outbound recruiter→candidate messages on an email-channel
      // thread are sent through the chat-send-email edge function (which writes
      // the message row, dispatches the email, and stamps tracking metadata).
      // Internal notes stay in-app regardless of channel.
      if (direction === 'out') {
        const { data: t } = await supabase
          .from('chat_threads')
          .select('channel')
          .eq('id', args.threadId)
          .maybeSingle()
        if (t?.channel === 'email') {
          const { data, error } = await supabase.functions.invoke('chat-send-email', {
            body: { threadId: args.threadId, body: args.body },
          })
          if (error) throw error
          const { data: row, error: rErr } = await supabase
            .from('chat_messages')
            .select(
              'id, thread_id, tenant_id, direction, sender_type, sender_user_id, body, parts, read_by_recipient_at, redacted_at, created_at',
            )
            .eq('id', (data as any)?.message_id)
            .maybeSingle()
          if (rErr || !row) throw rErr ?? new Error('message_not_found_after_send')
          return row as ChatMessageRow
        }
        // Phase 5.2 (deferred): WhatsApp channel is scaffolded but not wired to
        // a provider yet. Fail loudly so the UI can prompt to switch channel.
        if (t?.channel === 'whatsapp') {
          throw new Error(
            'WhatsApp channel isn\u2019t connected yet. Reply through in-app chat or email for now.',
          )
        }
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          thread_id: args.threadId,
          tenant_id: tenant.id,
          direction,
          sender_type: 'recruiter',
          sender_user_id: user.id,
          body: args.body,
        })
        .select()
        .single()
      if (error) throw error
      void logChatAuditEvent({
        tenantId: tenant.id,
        actorId: user.id,
        threadId: args.threadId,
        event: direction === 'note' ? 'internal_note_added' : 'message_sent',
        metadata: { body_length: args.body.length },
      })
      return data as ChatMessageRow
    },
    onMutate: async (args) => {
      const { threadId, body } = args
      const direction = resolveDirection(args)
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

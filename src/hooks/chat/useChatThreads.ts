import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabaseClient'
import { useAuth } from '@/contexts/AuthContext'
import { useTenant } from '@/hooks/useTenant'

export type ChatThreadScope = 'all' | 'unread' | 'assigned'

export interface ChatThreadRow {
  id: string
  tenant_id: string
  job_id: string | null
  candidate_id: string | null
  association_id: string | null
  channel: string
  mode: string
  status: string
  assigned_recruiter_id: string | null
  last_message_at: string | null
  last_message_preview: string | null
  message_count: number
  created_at: string
  updated_at: string
  candidate?: {
    id: string
    candidate_name: string | null
    email: string | null
    role_current: string | null
    current_job_title: string | null
  } | null
  job?: {
    id: string
    title: string | null
  } | null
  isUnread: boolean
  unreadCount: number
}

interface UseChatThreadsOptions {
  scope?: ChatThreadScope
  search?: string
}

/**
 * useChatThreads — fetch chat threads for the current tenant (Step 1.5).
 * Joins candidate + job for display; computes `isUnread` against the
 * current recruiter's own `chat_thread_reads` row.
 */
export function useChatThreads({ scope = 'all', search = '' }: UseChatThreadsOptions = {}) {
  const { user } = useAuth()
  const { tenant } = useTenant()
  const tenantId = tenant?.id
  const userId = user?.id

  return useQuery({
    queryKey: ['chat-threads', tenantId, userId, scope, search],
    enabled: Boolean(tenantId && userId),
    staleTime: 30_000,
    refetchOnMount: 'always',
    queryFn: async (): Promise<ChatThreadRow[]> => {
      if (!tenantId || !userId) return []

      const [threadsRes, readsRes] = await Promise.all([
        supabase
          .from('chat_threads')
          .select(
            `
            id, tenant_id, job_id, candidate_id, association_id,
            channel, mode, status, assigned_recruiter_id,
            last_message_at, last_message_preview,
            message_count, created_at, updated_at,
            candidate:candidates(id, candidate_name, email, role_current, current_job_title),
            job:jobs(id, title)
          `,
          )
          .eq('tenant_id', tenantId)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(200),
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

      const threadIds = (threadsRes.data ?? []).map((t: any) => t.id as string).filter(Boolean)
      const unreadCounts = new Map<string, number>()
      if (threadIds.length > 0) {
        const { data: messageRows, error: messageError } = await supabase
          .from('chat_messages')
          .select('thread_id, created_at')
          .eq('tenant_id', tenantId)
          .eq('direction', 'in')
          .in('thread_id', threadIds)

        if (messageError) throw messageError

        for (const message of messageRows ?? []) {
          const threadId = message.thread_id as string
          const createdAt = message.created_at ? new Date(message.created_at as string).getTime() : 0
          const lastRead = reads.get(threadId) ?? 0
          if (createdAt > lastRead) {
            unreadCounts.set(threadId, (unreadCounts.get(threadId) ?? 0) + 1)
          }
        }
      }

      const rows: ChatThreadRow[] = (threadsRes.data ?? []).map((t: any) => {
        const lastMsg = t.last_message_at ? new Date(t.last_message_at).getTime() : 0
        const lastRead = reads.get(t.id) ?? 0
        const unreadCount = unreadCounts.get(t.id) ?? 0
        return {
          ...t,
          candidate: Array.isArray(t.candidate) ? t.candidate[0] ?? null : t.candidate,
          job: Array.isArray(t.job) ? t.job[0] ?? null : t.job,
          isUnread: unreadCount > 0 || (lastMsg > 0 && lastMsg > lastRead),
          unreadCount,
        }
      })

      const scoped = rows.filter((row) => {
        if (scope === 'unread') return row.isUnread
        if (scope === 'assigned') return row.assigned_recruiter_id === userId
        return true
      })

      const q = search.trim().toLowerCase()
      if (!q) return scoped

      return scoped.filter((row) => {
        const name = row.candidate?.candidate_name?.toLowerCase() ?? ''
        const email = row.candidate?.email?.toLowerCase() ?? ''
        const role =
          row.candidate?.role_current?.toLowerCase() ??
          row.candidate?.current_job_title?.toLowerCase() ??
          ''
        const job = row.job?.title?.toLowerCase() ?? ''
        return name.includes(q) || email.includes(q) || role.includes(q) || job.includes(q)
      })
    },
  })
}

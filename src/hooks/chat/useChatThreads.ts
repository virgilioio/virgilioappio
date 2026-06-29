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
  last_recruiter_read_at: string | null
  message_count: number
  created_at: string
  candidate?: {
    id: string
    first_name: string | null
    last_name: string | null
    email: string | null
    avatar_url: string | null
  } | null
  job?: {
    id: string
    title: string | null
  } | null
  isUnread: boolean
}

interface UseChatThreadsOptions {
  scope?: ChatThreadScope
  search?: string
}

/**
 * useChatThreads — fetch chat threads for the current tenant (Step 1.5).
 * Joins candidate + job for display; filters client-side by scope and search.
 */
export function useChatThreads({ scope = 'all', search = '' }: UseChatThreadsOptions = {}) {
  const { user } = useAuth()
  const { tenant } = useTenant()
  const tenantId = tenant?.id

  return useQuery({
    queryKey: ['chat-threads', tenantId, scope, search],
    enabled: Boolean(tenantId && user?.id),
    staleTime: 30_000,
    queryFn: async (): Promise<ChatThreadRow[]> => {
      if (!tenantId) return []

      const { data, error } = await supabase
        .from('chat_threads')
        .select(
          `
          id, tenant_id, job_id, candidate_id, association_id,
          channel, mode, status, assigned_recruiter_id,
          last_message_at, last_message_preview, last_recruiter_read_at,
          message_count, created_at,
          candidate:candidates(id, first_name, last_name, email, avatar_url),
          job:jobs(id, title)
        `,
        )
        .eq('tenant_id', tenantId)
        .is('deleted_at', null)
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(200)

      if (error) throw error

      const rows: ChatThreadRow[] = (data ?? []).map((t: any) => {
        const lastMsg = t.last_message_at ? new Date(t.last_message_at).getTime() : 0
        const lastRead = t.last_recruiter_read_at
          ? new Date(t.last_recruiter_read_at).getTime()
          : 0
        return {
          ...t,
          candidate: Array.isArray(t.candidate) ? t.candidate[0] ?? null : t.candidate,
          job: Array.isArray(t.job) ? t.job[0] ?? null : t.job,
          isUnread: lastMsg > 0 && lastMsg > lastRead,
        }
      })

      const scoped = rows.filter((row) => {
        if (scope === 'unread') return row.isUnread
        if (scope === 'assigned') return row.assigned_recruiter_id === user?.id
        return true
      })

      const q = search.trim().toLowerCase()
      if (!q) return scoped

      return scoped.filter((row) => {
        const name =
          `${row.candidate?.first_name ?? ''} ${row.candidate?.last_name ?? ''}`.toLowerCase()
        const email = row.candidate?.email?.toLowerCase() ?? ''
        const job = row.job?.title?.toLowerCase() ?? ''
        return name.includes(q) || email.includes(q) || job.includes(q)
      })
    },
  })
}

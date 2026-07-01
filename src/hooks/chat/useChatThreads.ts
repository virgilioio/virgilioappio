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
  stageName: string | null
  recruiter?: {
    id: string
    first_name: string | null
    last_name: string | null
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
            message_count, created_at, updated_at
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

      const rawThreads = threadsRes.data ?? []
      const candidateIds = Array.from(
        new Set(rawThreads.map((t: any) => t.candidate_id as string | null).filter(Boolean)),
      ) as string[]
      const jobIds = Array.from(
        new Set(rawThreads.map((t: any) => t.job_id as string | null).filter(Boolean)),
      ) as string[]

      const associationIds = Array.from(
        new Set(rawThreads.map((t: any) => t.association_id as string | null).filter(Boolean)),
      ) as string[]
      const recruiterIds = Array.from(
        new Set(
          rawThreads.map((t: any) => t.assigned_recruiter_id as string | null).filter(Boolean),
        ),
      ) as string[]

      const [candidatesRes, jobsRes, associationsRes, recruitersRes] = await Promise.all([
        candidateIds.length > 0
          ? supabase
              .from('candidates')
              .select('id, candidate_name, email, role_current, current_job_title')
              .in('id', candidateIds)
          : Promise.resolve({ data: [], error: null }),
        jobIds.length > 0
          ? supabase.from('jobs').select('id, title').in('id', jobIds)
          : Promise.resolve({ data: [], error: null }),
        associationIds.length > 0
          ? (supabase
              .from('job_candidate_associations')
              .select(
                'id, job_hiring_stages!job_candidate_associations_current_stage_id_fkey(custom_stage_name, job_stages!job_hiring_stages_stage_id_fkey(stage_name))',
              )
              .in('id', associationIds) as any)
          : Promise.resolve({ data: [], error: null }),
        recruiterIds.length > 0
          ? (supabase
              .from('profiles')
              .select('id, first_name, last_name')
              .in('id', recruiterIds) as any)
          : Promise.resolve({ data: [], error: null }),
      ])

      const candidates = new Map<string, ChatThreadRow['candidate']>()
      for (const candidate of candidatesRes.error ? [] : candidatesRes.data ?? []) {
        candidates.set((candidate as any).id, candidate as ChatThreadRow['candidate'])
      }

      const jobs = new Map<string, ChatThreadRow['job']>()
      for (const job of jobsRes.error ? [] : jobsRes.data ?? []) {
        jobs.set((job as any).id, job as ChatThreadRow['job'])
      }

      const stages = new Map<string, string | null>()
      for (const a of associationsRes.error ? [] : (associationsRes.data as any[]) ?? []) {
        const hs = a.job_hiring_stages
        const name = hs?.custom_stage_name || hs?.job_stages?.stage_name || null
        stages.set(a.id, name)
      }

      const recruiters = new Map<string, ChatThreadRow['recruiter']>()
      for (const r of recruitersRes.error ? [] : (recruitersRes.data as any[]) ?? []) {
        recruiters.set(r.id, r as ChatThreadRow['recruiter'])
      }

      const reads = new Map<string, number>()
      for (const r of readsRes.data ?? []) {
        reads.set(r.thread_id as string, new Date(r.last_read_at as string).getTime())
      }

      const threadIds = rawThreads.map((t: any) => t.id as string).filter(Boolean)
      const unreadCounts = new Map<string, number>()
      if (threadIds.length > 0) {
        const { data: messageRows, error: messageError } = await supabase
          .from('chat_messages')
          .select('thread_id, created_at')
          .eq('tenant_id', tenantId)
          .eq('direction', 'in')
          .in('thread_id', threadIds)

        for (const message of messageError ? [] : messageRows ?? []) {
          const threadId = message.thread_id as string
          const createdAt = message.created_at ? new Date(message.created_at as string).getTime() : 0
          const lastRead = reads.get(threadId) ?? 0
          if (createdAt > lastRead) {
            unreadCounts.set(threadId, (unreadCounts.get(threadId) ?? 0) + 1)
          }
        }
      }

      const rows: ChatThreadRow[] = rawThreads.map((t: any) => {
        const lastMsg = t.last_message_at ? new Date(t.last_message_at).getTime() : 0
        const lastRead = reads.get(t.id) ?? 0
        const unreadCount = unreadCounts.get(t.id) ?? 0
        return {
          ...t,
          candidate: t.candidate_id ? candidates.get(t.candidate_id) ?? null : null,
          job: t.job_id ? jobs.get(t.job_id) ?? null : null,
          stageName: t.association_id ? stages.get(t.association_id) ?? null : null,
          recruiter: t.assigned_recruiter_id
            ? recruiters.get(t.assigned_recruiter_id) ?? null
            : null,
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

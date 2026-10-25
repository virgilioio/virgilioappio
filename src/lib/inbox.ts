import { useEffect } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/integrations/supabase/client'
import { useAuth } from '@/contexts/AuthContext'

/**
 * The Inbox (Allan, 2026-10-25): your own Gmail, candidate mail only, laid out
 * like a mail client. Everything is read through the inbox_* functions, which
 * keep it to your own mailbox and candidate conversations; marking goes
 * through inbox_mark. Gio never writes Gmail's own read flag.
 */

export type InboxFolder = 'inbox' | 'needs_reply' | 'sent' | 'done' | 'all'

export const FOLDERS: InboxFolder[] = ['inbox', 'needs_reply', 'sent', 'done', 'all']

export const FOLDER_LABELS: Record<InboxFolder, string> = {
  inbox: 'Inbox',
  needs_reply: 'Needs reply',
  sent: 'Sent',
  done: 'Done',
  all: 'All mail',
}

export interface InboxThread {
  thread_id: string
  candidate_id: string
  candidate_name: string
  candidate_email: string | null
  job_id: string | null
  job_title: string | null
  subject: string | null
  snippet: string | null
  last_at: string
  last_direction: 'sent' | 'received'
  message_count: number
  unread: boolean
  has_attachments: boolean
  done: boolean
}

export interface InboxAttachment {
  filename: string
  mimeType?: string
  content_type?: string
  size?: number
  storagePath?: string
}

export interface InboxMessage {
  id: string
  direction: 'sent' | 'received'
  status: string | null
  from_address: string
  to_addresses: string[]
  cc_addresses: string[] | null
  subject: string | null
  body_html: string | null
  body_text: string | null
  snippet: string | null
  at: string
  attachments: InboxAttachment[]
  candidate_id: string | null
  job_id: string | null
}

export interface InboxConversation {
  thread: Omit<InboxThread, 'snippet' | 'has_attachments'>
  messages: InboxMessage[]
}

export interface InboxCounts {
  inbox_unread: number
  needs_reply: number
  jobs: { job_id: string; title: string; unread: number }[]
}

export type InboxAction = 'read' | 'unread' | 'done' | 'inbox'

/** The newest conversations a folder shows; search reaches the rest. */
export const MAX_ROWS = 200

const keys = {
  all: (uid?: string) => ['inbox', uid] as const,
  access: (uid?: string) => ['inbox', uid, 'access'] as const,
  counts: (uid?: string) => ['inbox', uid, 'counts'] as const,
  threads: (uid: string | undefined, folder: InboxFolder, jobId: string | null, search: string) =>
    ['inbox', uid, 'threads', folder, jobId, search] as const,
  thread: (uid: string | undefined, threadId: string | null) => ['inbox', uid, 'thread', threadId] as const,
}

/** Admins and anyone holding a Recruiter or Sourcer seat on an open job. */
export function useInboxAccess() {
  const { user } = useAuth()
  return useQuery({
    queryKey: keys.access(user?.id),
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('inbox_access')
      if (error) throw error
      return !!data
    },
  })
}

export function useInboxCounts(enabled = true) {
  const { user } = useAuth()
  return useQuery({
    queryKey: keys.counts(user?.id),
    enabled: enabled && !!user?.id,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('inbox_counts')
      if (error) throw error
      const d = (data ?? {}) as Partial<InboxCounts>
      return { inbox_unread: Number(d.inbox_unread ?? 0), needs_reply: Number(d.needs_reply ?? 0), jobs: d.jobs ?? [] }
    },
  })
}

export function useInboxThreads(folder: InboxFolder, jobId: string | null, search: string) {
  const { user } = useAuth()
  return useQuery({
    queryKey: keys.threads(user?.id, folder, jobId, search),
    enabled: !!user?.id,
    // Keep the rows on screen while a folder, job or search refetches.
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('inbox_threads', {
        _folder: folder,
        _job_id: jobId ?? undefined,
        _search: search || undefined,
        _limit: MAX_ROWS,
      })
      if (error) throw error
      return (data ?? []) as InboxThread[]
    },
  })
}

export function useInboxConversation(threadId: string | null) {
  const { user } = useAuth()
  return useQuery({
    queryKey: keys.thread(user?.id, threadId),
    enabled: !!user?.id && !!threadId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('inbox_thread', { _thread_id: threadId! })
      if (error) throw error
      return (data ?? null) as unknown as InboxConversation | null
    },
  })
}

/** Does this row still belong in the folder after the action? */
function staysIn(folder: InboxFolder, action: InboxAction) {
  if (action === 'done') return folder === 'done' || folder === 'all' || folder === 'sent'
  if (action === 'inbox') return folder !== 'done'
  return true
}

/**
 * Mark threads read, unread, Done or back to the Inbox. Optimistic: rows
 * change (or leave the folder) at once, counts follow, and a failure puts
 * everything back before the caller's toast.
 */
export function useInboxMark() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ threadIds, action }: { threadIds: string[]; action: InboxAction }) => {
      const { data, error } = await supabase.rpc('inbox_mark', { _thread_ids: threadIds, _action: action })
      if (error) throw error
      return Number(data ?? 0)
    },
    onMutate: async ({ threadIds, action }) => {
      await qc.cancelQueries({ queryKey: keys.all(user?.id) })
      const ids = new Set(threadIds)
      const snapshot = qc.getQueriesData({ queryKey: keys.all(user?.id) })
      qc.getQueriesData<InboxThread[]>({ queryKey: ['inbox', user?.id, 'threads'] }).forEach(([key, rows]) => {
        if (!rows) return
        const folder = key[3] as InboxFolder
        qc.setQueryData<InboxThread[]>(
          key,
          rows
            .filter(t => !ids.has(t.thread_id) || staysIn(folder, action))
            .map(t => {
              if (!ids.has(t.thread_id)) return t
              if (action === 'read') return { ...t, unread: false }
              if (action === 'unread') return { ...t, unread: true }
              return { ...t, done: action === 'done' }
            }),
        )
      })
      qc.getQueriesData<InboxConversation | null>({ queryKey: ['inbox', user?.id, 'thread'] }).forEach(([key, data]) => {
        if (!data || !ids.has(data.thread.thread_id)) return
        const t = data.thread
        qc.setQueryData(key, {
          ...data,
          thread: {
            ...t,
            unread: action === 'read' ? false : action === 'unread' ? true : t.unread,
            done: action === 'done' ? true : action === 'inbox' ? false : t.done,
          },
        })
      })
      return { snapshot }
    },
    onError: (_e, _v, ctx) => {
      ctx?.snapshot.forEach(([key, data]) => qc.setQueryData(key, data))
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: keys.counts(user?.id) })
      qc.invalidateQueries({ queryKey: ['inbox', user?.id, 'threads'] })
    },
  })
}

/**
 * New mail (the Gmail sync, or a reply you sent) reaches every Inbox view at
 * once. Mounted once in the rail, so the unread number stays live everywhere.
 */
export function useInboxLive(enabled: boolean) {
  const { user } = useAuth()
  const qc = useQueryClient()
  useEffect(() => {
    if (!enabled || !user?.id) return
    let timer: ReturnType<typeof setTimeout> | undefined
    const refresh = () => {
      // A sync writes several rows at once: one refetch for the batch.
      clearTimeout(timer)
      timer = setTimeout(() => qc.invalidateQueries({ queryKey: keys.all(user.id) }), 400)
    }
    const channel = supabase
      .channel(`inbox:${user.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'email_logs', filter: `user_id=eq.${user.id}` }, refresh)
      .subscribe()
    return () => {
      clearTimeout(timer)
      supabase.removeChannel(channel)
    }
  }, [enabled, user?.id, qc])
}

/** Refetch everything the Inbox shows (after a send, or Retry). */
export function useRefreshInbox() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: keys.all(user?.id) })
}

/** "now", "5m", "3h" today; "Oct 12" this year; "Oct 12, 2025" before. */
export function inboxTime(iso: string, now = new Date()): string {
  const d = new Date(iso)
  const diff = now.getTime() - d.getTime()
  if (diff < 60_000) return 'now'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m`
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
  }
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  }
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** The full date a message header shows. */
export function inboxFullTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
  })
}

/** "Ana Pérez <ana@x.com>" → "Ana Pérez"; a bare address stays as it is. */
export function displayName(address: string): string {
  const m = /^\s*"?([^"<]+?)"?\s*<[^>]+>\s*$/.exec(address)
  return m ? m[1] : address
}

/** Plain address out of "Name <address>". */
export function bareAddress(address: string): string {
  const m = /<([^>]+)>/.exec(address)
  return (m ? m[1] : address).trim().toLowerCase()
}

/**
 * Reply all: everyone on the message except you. The candidate (or whoever
 * wrote) goes in To, the rest in Cc.
 */
export function replyAllRecipients(message: InboxMessage, mine: string[]): { to: string; cc: string[] } {
  const me = new Set(mine.map(bareAddress))
  const seen = new Set<string>()
  const keep = (a: string) => {
    const b = bareAddress(a)
    if (!b || me.has(b) || seen.has(b)) return false
    seen.add(b)
    return true
  }
  const first = message.direction === 'received' ? [message.from_address] : message.to_addresses
  const to = first.filter(keep)
  const cc = [...(message.direction === 'received' ? message.to_addresses : []), ...(message.cc_addresses ?? [])].filter(keep)
  return { to: to[0] ?? message.from_address, cc: [...to.slice(1), ...cc] }
}

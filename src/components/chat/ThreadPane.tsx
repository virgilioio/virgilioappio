import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { EmptyState } from '@/components/ui/empty-state'
import { SoftBubble } from '@/components/ui/EmptyIllustrations'
import { Skeleton } from '@/components/ui/skeleton'
import { MessageList } from '@/components/chat/MessageList'
import { Composer } from '@/components/chat/Composer'

interface ThreadPaneProps {
  threadId?: string
}

interface ThreadHeader {
  id: string
  status: string
  mode: string
  candidate: { first_name: string | null; last_name: string | null; email: string | null } | null
  job: { title: string | null } | null
}

function useThreadHeader(threadId: string | undefined) {
  const [data, setData] = useState<ThreadHeader | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let alive = true
    if (!threadId) {
      setData(null)
      return
    }
    setLoading(true)
    supabase
      .from('chat_threads')
      .select(
        'id, status, mode, candidate:candidates(first_name, last_name, email), job:jobs(title)',
      )
      .eq('id', threadId)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive) return
        setData(
          data
            ? ({
                ...(data as any),
                candidate: Array.isArray((data as any).candidate)
                  ? (data as any).candidate[0]
                  : (data as any).candidate,
                job: Array.isArray((data as any).job) ? (data as any).job[0] : (data as any).job,
              } as ThreadHeader)
            : null,
        )
        setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [threadId])

  return { data, loading }
}

/**
 * ThreadPane — header, messages, and a temporary inline composer (Step 1.6).
 * The real composer ships in Step 1.7.
 */
export function ThreadPane({ threadId }: ThreadPaneProps) {
  const { data: header, loading } = useThreadHeader(threadId)
  const [draft, setDraft] = useState('')
  const send = useSendChatMessage()

  if (!threadId) {
    return (
      <section className="flex-1 min-w-0 flex flex-col bg-surface-primary" aria-label="Thread">
        <div className="flex-1 flex items-center justify-center p-8">
          <EmptyState
            size="route"
            illustration={<SoftBubble />}
            title="Select a conversation"
            body="Pick a candidate thread on the left to start messaging. New incoming chats will appear here."
          />
        </div>
      </section>
    )
  }

  const fullName = header?.candidate
    ? `${header.candidate.first_name ?? ''} ${header.candidate.last_name ?? ''}`.trim() ||
      header.candidate.email ||
      'Candidate'
    : 'Candidate'

  const onSend = async () => {
    const body = draft.trim()
    if (!body) return
    setDraft('')
    try {
      await send.mutateAsync({ threadId, body })
    } catch {
      setDraft(body)
    }
  }

  return (
    <section className="flex-1 min-w-0 flex flex-col bg-surface-primary" aria-label="Thread">
      <header className="flex items-center h-14 px-5 border-b border-virgilio-border">
        {loading ? (
          <div className="flex items-center gap-2.5">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 w-40" />
          </div>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-8 w-8 rounded-full bg-[#EDE4FF] text-[#5B3FBF] flex items-center justify-center font-poppins font-semibold text-[12px]">
              {(header?.candidate?.first_name?.[0] ?? '?').toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-poppins font-semibold text-[14px] tracking-[-0.02em] text-virgilio-text truncate">
                {fullName}
              </div>
              {header?.job?.title && (
                <div className="text-[11.5px] text-text-secondary truncate">
                  {header.job.title}
                </div>
              )}
            </div>
            {header?.status && header.status !== 'open' && (
              <span className="ml-2 text-[10.5px] uppercase tracking-[0.06em] px-2 py-0.5 rounded-full bg-surface-secondary text-text-secondary">
                {header.status}
              </span>
            )}
          </div>
        )}
      </header>

      <MessageList threadId={threadId} />

      <footer className="border-t border-virgilio-border p-3">
        <div className="rounded-lg border border-virgilio-border bg-surface-primary focus-within:ring-2 focus-within:ring-virgilio-purple/30">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                onSend()
              }
            }}
            placeholder="Write a message…"
            rows={2}
            className="w-full resize-none bg-transparent px-3 py-2 text-[13.5px] outline-none placeholder:text-text-secondary"
          />
          <div className="flex items-center justify-between px-2 py-1.5 border-t border-virgilio-border">
            <span className="text-[10.5px] text-text-secondary font-mono px-1">
              <MessageSquare className="inline h-3 w-3 mr-1" />
              Composer placeholder · Step 1.7
            </span>
            <Button size="sm" onClick={onSend} disabled={!draft.trim() || send.isPending}>
              {send.isPending ? 'Sending…' : 'Send'}
            </Button>
          </div>
        </div>
      </footer>
    </section>
  )
}

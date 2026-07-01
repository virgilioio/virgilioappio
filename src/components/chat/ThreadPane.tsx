import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { EmptyState } from '@/components/ui/empty-state'
import { SoftBubble } from '@/components/ui/EmptyIllustrations'
import { Skeleton } from '@/components/ui/skeleton'
import { MessageList } from '@/components/chat/MessageList'
import { Composer } from '@/components/chat/Composer'
import { useChatKillSwitch } from '@/hooks/chat/useChatKillSwitch'
import { useMarkThreadRead } from '@/hooks/chat/useMarkThreadRead'
import { PauseCircle } from 'lucide-react'
import { AiSummaryCard } from '@/components/chat/AiSummaryCard'
import { ConnectChannelCTA } from '@/components/chat/ConnectChannelCTA'

interface ThreadPaneProps {
  threadId?: string
}

interface ThreadHeader {
  id: string
  status: string
  mode: string
  last_message_at: string | null
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
        'id, status, mode, last_message_at, candidate:candidates(first_name, last_name, email), job:jobs(title)',
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
 * ThreadPane — header, messages, and composer (Step 1.7).
 */
export function ThreadPane({ threadId }: ThreadPaneProps) {
  const { data: header, loading } = useThreadHeader(threadId)
  const { isPaused } = useChatKillSwitch()
  useMarkThreadRead(threadId, header?.last_message_at ?? null)

  if (!threadId) {
    return (
      <section className="flex-1 min-w-0 flex flex-col bg-surface-primary" aria-label="Thread">
        <div className="flex-1 flex flex-col items-center justify-center p-8">
          <EmptyState
            size="route"
            illustration={<SoftBubble />}
            title="Select a conversation"
            body="Pick a candidate thread on the left to start messaging. New incoming chats will appear here."
          />
          <ConnectChannelCTA />
        </div>
      </section>
    )
  }

  const fullName = header?.candidate
    ? `${header.candidate.first_name ?? ''} ${header.candidate.last_name ?? ''}`.trim() ||
      header.candidate.email ||
      'Candidate'
    : 'Candidate'

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

      {isPaused && (
        <div
          role="status"
          className="flex items-start gap-2.5 px-5 py-2.5 bg-[#FFF7E0] border-b border-[#F2E2A8] text-[12.5px] text-[#5A4A12] font-inter"
        >
          <PauseCircle className="h-4 w-4 mt-[1px] shrink-0 text-[#8A6A0F]" />
          <div className="min-w-0">
            <span className="font-poppins font-semibold mr-1.5">Candidate chat is paused.</span>
            New candidate messages and AI replies are blocked workspace-wide. Resume in
            Settings → Workspace.
          </div>
        </div>
      )}

      <div className="px-5 pt-3">
        <AiSummaryCard threadId={threadId} />
      </div>

      <MessageList threadId={threadId} />

      <Composer threadId={threadId} disabled={isPaused} />
    </section>
  )
}

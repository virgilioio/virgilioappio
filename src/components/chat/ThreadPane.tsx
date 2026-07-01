import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabaseClient'
import { EmptyState, EmptyAction } from '@/components/ui/empty-state'
import { SoftBubble } from '@/components/ui/EmptyIllustrations'
import { Skeleton } from '@/components/ui/skeleton'
import { MessageList } from '@/components/chat/MessageList'
import { Composer } from '@/components/chat/Composer'
import { useChatKillSwitch } from '@/hooks/chat/useChatKillSwitch'
import { useMarkThreadRead } from '@/hooks/chat/useMarkThreadRead'
import { PauseCircle, PenLine, Link as LinkIcon } from 'lucide-react'
import { AiSummaryCard } from '@/components/chat/AiSummaryCard'
import { useChatThreads } from '@/hooks/chat/useChatThreads'
import { NewMessageSheet } from '@/components/chat/NewMessageSheet'

interface ThreadPaneProps {
  threadId?: string
}

interface ThreadHeader {
  id: string
  status: string
  mode: string
  last_message_at: string | null
  candidate_id: string | null
  job_id: string | null
  candidate: {
    id: string
    candidate_name: string | null
    email: string | null
    role_current: string | null
    current_job_title: string | null
  } | null
  job: { id: string; title: string | null } | null
}

function candidateInitial(candidate: ThreadHeader['candidate']) {
  const name = candidate?.candidate_name?.trim()
  if (!name) return candidate?.email?.[0]?.toUpperCase() || '?'
  return name[0]?.toUpperCase() || '?'
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
    ;(async () => {
      const { data: thread, error: threadError } = await supabase
        .from('chat_threads')
        .select('id, status, mode, last_message_at, candidate_id, job_id')
        .eq('id', threadId)
        .maybeSingle()

      if (!alive) return
      if (threadError || !thread) {
        setData(null)
        setLoading(false)
        return
      }

      const [candidateRes, jobRes] = await Promise.all([
        thread.candidate_id
          ? supabase
              .from('candidates')
              .select('id, candidate_name, email, role_current, current_job_title')
              .eq('id', thread.candidate_id)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        thread.job_id
          ? supabase.from('jobs').select('id, title').eq('id', thread.job_id).maybeSingle()
          : Promise.resolve({ data: null, error: null }),
      ])

      if (!alive) return
      setData({
        ...(thread as any),
        candidate: candidateRes.error ? null : ((candidateRes.data as ThreadHeader['candidate']) ?? null),
        job: jobRes.error ? null : ((jobRes.data as ThreadHeader['job']) ?? null),
      } as ThreadHeader)
      setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [threadId])

  return { data, loading }
}

/**
 * ThreadPane — header, messages, composer, and Chat zero-state variants.
 */
export function ThreadPane({ threadId }: ThreadPaneProps) {
  const { data: header, loading } = useThreadHeader(threadId)
  const { isPaused } = useChatKillSwitch()
  useMarkThreadRead(threadId, header?.last_message_at ?? null)
  const navigate = useNavigate()
  const allThreads = useChatThreads({ scope: 'all', search: '' })
  const [composeOpen, setComposeOpen] = useState(false)

  if (!threadId) {
    const hasAnyThreads = (allThreads.data?.length ?? 0) > 0

    return (
      <section
        className="flex-1 min-w-0 flex flex-col"
        style={{ background: '#FAFAF7' }}
        aria-label="Thread"
      >
        <div className="flex-1 flex items-center justify-center p-8">
          {hasAnyThreads ? (
            // Bare "no selection" state — no card border.
            <div className="flex flex-col items-center text-center max-w-[420px]">
              <div className="mb-2">
                <SoftBubble />
              </div>
              <h2 className="font-poppins font-semibold text-[22px] tracking-[-0.025em] text-[#0d0d09]">
                Select a conversation
              </h2>
              <p className="mt-2.5 font-inter text-[14px] leading-[1.55] text-[#5A6072]">
                Choose a candidate from the left to pick up where you left off — or start a new
                message.
              </p>
              <div className="mt-5">
                <EmptyAction
                  icon={<PenLine size={16} strokeWidth={1.9} />}
                  onClick={() => setComposeOpen(true)}
                >
                  New message
                </EmptyAction>
              </div>
            </div>
          ) : (
            // True zero — canonical card EmptyState.
            <EmptyState
              size="route"
              illustration={<SoftBubble />}
              title="No conversations yet"
              body="Chat brings every conversation — in-app, email, and WhatsApp — into one calm space, with Gio drafting and summarizing alongside you."
              primary={
                <EmptyAction
                  icon={<PenLine size={16} strokeWidth={1.9} />}
                  onClick={() => setComposeOpen(true)}
                >
                  New message
                </EmptyAction>
              }
              secondary={
                <EmptyAction
                  variant="secondary"
                  icon={<LinkIcon size={16} strokeWidth={1.9} />}
                  onClick={() => navigate('/settings?tab=organization#chat-channels')}
                >
                  Connect a channel
                </EmptyAction>
              }
            />
          )}
        </div>
        <NewMessageSheet open={composeOpen} onOpenChange={setComposeOpen} />
      </section>
    )
  }

  const fullName = header?.candidate
    ? header.candidate.candidate_name?.trim() || header.candidate.email || 'Candidate'
    : 'Candidate'

  const subtitle =
    header?.candidate?.role_current || header?.candidate?.current_job_title || header?.job?.title || ''

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
              {candidateInitial(header?.candidate ?? null)}
            </div>
            <div className="min-w-0">
              <div className="font-poppins font-semibold text-[14px] tracking-[-0.02em] text-virgilio-text truncate">
                {fullName}
              </div>
              {subtitle && (
                <div className="text-[11.5px] text-text-secondary truncate">
                  {subtitle}
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

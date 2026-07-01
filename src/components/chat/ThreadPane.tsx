import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { supabase } from '@/lib/supabaseClient'
import { EmptyState, EmptyAction } from '@/components/ui/empty-state'
import { SoftBubble } from '@/components/ui/EmptyIllustrations'
import { Skeleton } from '@/components/ui/skeleton'
import { MessageList } from '@/components/chat/MessageList'
import { Composer } from '@/components/chat/Composer'
import { useChatKillSwitch } from '@/hooks/chat/useChatKillSwitch'
import { useMarkThreadRead } from '@/hooks/chat/useMarkThreadRead'
import {
  PauseCircle,
  PenLine,
  Link as LinkIcon,
  Sparkles,
  MoreHorizontal,
} from 'lucide-react'
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
  channel: string | null
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

const AVATAR_PALETTE = [
  { bg: '#EDE4FF', fg: '#5B3FBF' },
  { bg: '#DBEAFE', fg: '#1E40AF' },
  { bg: '#D1FAE5', fg: '#065F46' },
  { bg: '#FEF3C7', fg: '#92400E' },
  { bg: '#FCE7F3', fg: '#9D174D' },
  { bg: '#FEE2E2', fg: '#991B1B' },
  { bg: '#E0E7FF', fg: '#3730A3' },
  { bg: '#CFFAFE', fg: '#155E75' },
]
function avatarColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length]
}
function candidateInitials(candidate: ThreadHeader['candidate']) {
  const name = candidate?.candidate_name?.trim()
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean)
    return (
      ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase() ||
      '?'
    )
  }
  return candidate?.email?.[0]?.toUpperCase() ?? '?'
}

const CHANNEL_META: Record<string, { color: string; label: string }> = {
  in_app: { color: '#6F3FF5', label: 'In-app' },
  email: { color: '#2563EB', label: 'Email' },
  whatsapp: { color: '#12B886', label: 'WhatsApp' },
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
        .select('id, status, mode, channel, last_message_at, candidate_id, job_id')
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
        candidate: candidateRes.error
          ? null
          : ((candidateRes.data as ThreadHeader['candidate']) ?? null),
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
 * ThreadPane — middle pane. Warm off-white surface with header, messages,
 * suggested replies + composer. Toggling Summarize pins the AI summary card at
 * the top of the messages area.
 */
export function ThreadPane({ threadId }: ThreadPaneProps) {
  const { data: header, loading } = useThreadHeader(threadId)
  const { isPaused } = useChatKillSwitch()
  useMarkThreadRead(threadId, header?.last_message_at ?? null)
  const navigate = useNavigate()
  const allThreads = useChatThreads({ scope: 'all', search: '' })
  const [composeOpen, setComposeOpen] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  const [summaryKey, setSummaryKey] = useState(0)

  // Reset summary visibility when switching threads.
  useEffect(() => {
    setSummaryOpen(false)
    setSummaryKey(0)
  }, [threadId])

  const channelMeta = useMemo(
    () => CHANNEL_META[header?.channel ?? 'in_app'] ?? CHANNEL_META.in_app,
    [header?.channel],
  )

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
    header?.candidate?.role_current ||
    header?.candidate?.current_job_title ||
    header?.job?.title ||
    ''
  const seed = header?.candidate?.id ?? threadId
  const color = avatarColor(seed)

  return (
    <section
      className="flex-1 min-w-0 flex flex-col"
      style={{ background: '#FAFAF7' }}
      aria-label="Thread"
    >
      {/* Header */}
      <header
        className="flex items-center shrink-0"
        style={{
          padding: '13px 22px',
          gap: 12,
          borderBottom: '1px solid #E7E8EE',
          background: '#FAFAF7',
        }}
      >
        {loading ? (
          <>
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-3.5 w-40" />
              <Skeleton className="h-3 w-24" />
            </div>
          </>
        ) : (
          <>
            <div
              className="flex items-center justify-center font-poppins font-semibold shrink-0"
              style={{
                height: 36,
                width: 36,
                borderRadius: 999,
                background: color.bg,
                color: color.fg,
                fontSize: 13,
                letterSpacing: '-0.01em',
              }}
              aria-hidden
            >
              {candidateInitials(header?.candidate ?? null)}
            </div>
            <div className="min-w-0">
              <div
                className="font-poppins truncate"
                style={{
                  fontSize: 14.5,
                  fontWeight: 600,
                  color: '#0d0d09',
                  letterSpacing: '-0.015em',
                }}
              >
                {fullName}
              </div>
              <div
                className="flex items-center font-inter"
                style={{ gap: 7, marginTop: 2, fontSize: 11.5, color: '#5A6072' }}
              >
                {subtitle && <span className="truncate">{subtitle}</span>}
                {subtitle && (
                  <span
                    aria-hidden
                    style={{
                      height: 3,
                      width: 3,
                      borderRadius: 999,
                      background: '#C7CAD1',
                    }}
                  />
                )}
                <span className="inline-flex items-center" style={{ gap: 5 }}>
                  <span
                    aria-hidden
                    style={{
                      height: 6,
                      width: 6,
                      borderRadius: 999,
                      background: channelMeta.color,
                    }}
                  />
                  {channelMeta.label}
                </span>
              </div>
            </div>

            <div className="ml-auto flex items-center" style={{ gap: 8 }}>
              <button
                type="button"
                onClick={() => {
                  if (summaryOpen) {
                    setSummaryOpen(false)
                  } else {
                    setSummaryOpen(true)
                    setSummaryKey((k) => k + 1)
                  }
                }}
                className="inline-flex items-center font-poppins transition-colors"
                style={{
                  gap: 6,
                  height: 30,
                  padding: '0 11px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 500,
                  background: summaryOpen ? '#EDE4FF' : '#FFFFFF',
                  color: summaryOpen ? '#6F3FF5' : '#1F2230',
                  border: `1px solid ${summaryOpen ? '#E4D8FF' : '#E7E8EE'}`,
                }}
              >
                <Sparkles style={{ height: 13, width: 13 }} strokeWidth={2} />
                {summaryOpen ? 'Hide summary' : 'Summarize'}
              </button>
              <button
                type="button"
                aria-label="More actions"
                className="inline-flex items-center justify-center transition-colors hover:bg-[#F6F5F1]"
                style={{
                  height: 30,
                  width: 30,
                  borderRadius: 8,
                  border: '1px solid #E7E8EE',
                  background: '#FFFFFF',
                  color: '#5A6072',
                }}
              >
                <MoreHorizontal style={{ height: 16, width: 16 }} strokeWidth={2} />
              </button>
            </div>
          </>
        )}
      </header>

      {isPaused && (
        <div
          role="status"
          className="flex items-start gap-2.5 px-5 py-2.5 bg-[#FFF7E0] border-b border-[#F2E2A8] text-[12.5px] text-[#5A4A12] font-inter shrink-0"
        >
          <PauseCircle className="h-4 w-4 mt-[1px] shrink-0 text-[#8A6A0F]" />
          <div className="min-w-0">
            <span className="font-poppins font-semibold mr-1.5">
              Candidate chat is paused.
            </span>
            New candidate messages and AI replies are blocked workspace-wide. Resume in Settings →
            Workspace.
          </div>
        </div>
      )}

      {/* Messages area (scrolls) */}
      <MessageList
        threadId={threadId}
        topSlot={
          <AiSummaryCard
            threadId={threadId}
            open={summaryOpen}
            reloadKey={summaryKey}
            onClose={() => setSummaryOpen(false)}
          />
        }
      />

      <Composer threadId={threadId} disabled={isPaused} />
    </section>
  )
}


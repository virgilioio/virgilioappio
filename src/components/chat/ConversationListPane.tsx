import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PenLine, Search } from 'lucide-react'
import { formatDistanceToNowStrict, isYesterday } from 'date-fns'
import { InlineEmpty } from '@/components/ui/empty-state'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  useChatThreads,
  type ChatThreadRow,
  type ChatThreadScope,
} from '@/hooks/chat/useChatThreads'
import { ChatSlaWidget } from '@/components/chat/ChatSlaWidget'
import { AdminChatAuditViewer } from '@/components/chat/AdminChatAuditViewer'
import { usePermissions } from '@/hooks/usePermissions'
import { ChannelDot } from '@/components/chat/ChannelDot'
import {
  ConversationFilterPills,
  type ConversationPillFilters,
} from '@/components/chat/ConversationFilterPills'
import { NewMessageSheet } from '@/components/chat/NewMessageSheet'

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

function hashIndex(seed: string, len: number) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0
  return Math.abs(h) % len
}

function avatarColor(seed: string) {
  return AVATAR_PALETTE[hashIndex(seed, AVATAR_PALETTE.length)]
}

function initialsOf(name: string | null | undefined, fallback: string) {
  const n = name?.trim()
  if (n) {
    const parts = n.split(/\s+/).filter(Boolean)
    const first = parts[0]?.[0] ?? ''
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
    return (first + last).toUpperCase() || fallback
  }
  return fallback
}

function fullName(row: ChatThreadRow) {
  return row.candidate?.candidate_name?.trim() || row.candidate?.email || 'Unknown candidate'
}

function jobLabel(row: ChatThreadRow) {
  return row.job?.title || row.candidate?.role_current || row.candidate?.current_job_title || ''
}

function previewLabel(row: ChatThreadRow) {
  const preview = row.last_message_preview?.trim()
  if (!preview) return 'No messages yet'
  return preview.replace(/\s+/g, ' ')
}

function timeAgo(iso: string | null) {
  if (!iso) return ''
  try {
    const d = new Date(iso)
    if (isYesterday(d)) return 'Yesterday'
    return formatDistanceToNowStrict(d, { addSuffix: false }).replace(
      /( seconds?| minutes?| hours?| days?| months?| years?)/,
      (m) => m.trim()[0],
    )
  } catch {
    return ''
  }
}

const STAGE_TONES: Array<{
  match: RegExp
  dot: string
  fg: string
  bg: string
  label?: string
}> = [
  { match: /hired/i, dot: '#12B886', fg: '#065F46', bg: '#D1FAE5' },
  { match: /offer/i, dot: '#12B886', fg: '#065F46', bg: '#D1FAE5' },
  { match: /interview|onsite|take.?home/i, dot: '#6F3FF5', fg: '#5B21B6', bg: '#EDE4FF' },
  { match: /screen|phone/i, dot: '#2563EB', fg: '#1E40AF', bg: '#DBEAFE' },
  { match: /appl|sourced|new/i, dot: '#8B8F9E', fg: '#5A6072', bg: '#F1F0EC' },
]

function stageTone(name: string | null) {
  if (!name) return null
  for (const t of STAGE_TONES) if (t.match.test(name)) return t
  return { dot: '#8B8F9E', fg: '#5A6072', bg: '#F1F0EC' }
}

/**
 * ConversationListPane — left conversation pane.
 * Fixed 320px, per Gio Chat spec.
 */
export function ConversationListPane() {
  const navigate = useNavigate()
  const location = useLocation()
  const { threadId: activeId } = useParams<{ threadId: string }>()
  const [params, setParams] = useSearchParams()
  const scope = ((params.get('scope') as ChatThreadScope) || 'all') as ChatThreadScope
  const { isPlatformAdmin, isWorkspaceOwner, isAdmin } = usePermissions()
  const isChatAdmin = isPlatformAdmin || isWorkspaceOwner || isAdmin

  const [search, setSearch] = useState('')
  const [pillFilters, setPillFilters] = useState<ConversationPillFilters>({
    unreadOnly: false,
    jobIds: [],
    stageIds: [],
  })
  const [composeOpen, setComposeOpen] = useState(false)

  useEffect(() => {
    if (!(location.state as { chatNotificationOpen?: boolean } | null)?.chatNotificationOpen) return
    setSearch('')
    setPillFilters({ unreadOnly: false, jobIds: [], stageIds: [] })
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.delete('scope')
        return next
      },
      { replace: true },
    )
  }, [activeId, location.state, setParams])

  const allQuery = useChatThreads({ scope: 'all', search: '' })
  const filteredQuery = useChatThreads({ scope, search })

  const rows = useMemo(() => {
    let list = filteredQuery.data ?? []
    if (pillFilters.unreadOnly) list = list.filter((r) => r.isUnread)
    if (pillFilters.jobIds.length > 0)
      list = list.filter((r) => r.job_id && pillFilters.jobIds.includes(r.job_id))
    if (activeId && !list.some((r) => r.id === activeId)) {
      const activeRow = allQuery.data?.find((r) => r.id === activeId)
      if (activeRow) list = [activeRow, ...list]
    }
    return list
  }, [activeId, allQuery.data, filteredQuery.data, pillFilters])

  const isLoading = filteredQuery.isLoading
  const hasError = filteredQuery.isError || allQuery.isError
  const totalThreadCount = allQuery.data?.length ?? 0
  const isTrueZero = !isLoading && !hasError && totalThreadCount === 0
  const isFilteredEmpty = !isLoading && !hasError && !isTrueZero && rows.length === 0

  return (
    <>
      <aside
        className="hidden md:flex flex-col bg-white"
        style={{ width: 320, flexShrink: 0, borderRight: '1px solid #E7E8EE' }}
        aria-label="Conversations"
      >
        {/* Header block */}
        <div style={{ padding: '18px 16px 12px' }}>
          <div className="flex items-center gap-2" style={{ marginBottom: 13 }}>
            <h2
              className="font-poppins font-semibold"
              style={{ fontSize: 16, letterSpacing: '-0.025em', color: '#0d0d09' }}
            >
              Conversations
            </h2>
            <span
              className="inline-flex items-center justify-center font-inter"
              style={{
                padding: '2px 8px',
                background: '#F1F0EC',
                color: '#5A6072',
                fontWeight: 500,
                fontSize: 11,
                borderRadius: 999,
              }}
              aria-label={`${totalThreadCount} conversations`}
            >
              {totalThreadCount}
            </span>
            <div className="ml-auto flex items-center gap-1">
              {isChatAdmin && <AdminChatAuditViewer />}
              <button
                type="button"
                onClick={() => setComposeOpen(true)}
                aria-label="New message"
                title="New message"
                className="inline-flex items-center justify-center bg-white hover:bg-[#FAFAF7] transition-colors"
                style={{
                  height: 30,
                  width: 30,
                  borderRadius: 8,
                  border: '1px solid #E7E8EE',
                  color: '#0d0d09',
                }}
              >
                <PenLine style={{ height: 15, width: 15 }} strokeWidth={2} />
              </button>
            </div>
          </div>

          <label
            className="flex items-center"
            style={{
              marginBottom: 11,
              height: 34,
              padding: '0 11px',
              background: '#F6F5F1',
              borderRadius: 9,
              gap: 8,
            }}
          >
            <Search style={{ height: 14, width: 14, color: '#8B8F9E' }} strokeWidth={2} />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations"
              className="flex-1 bg-transparent outline-none font-inter"
              style={{ fontSize: 12.5, color: '#1F2230' }}
              aria-label="Search conversations"
            />
          </label>

          <ConversationFilterPills value={pillFilters} onChange={setPillFilters} />
        </div>

        {isChatAdmin && (
          <div className="px-4 pb-2">
            <ChatSlaWidget />
          </div>
        )}

        <div className="flex-1 overflow-auto" style={{ borderTop: '1px solid #F1F0EC' }}>
          {isLoading ? (
            <ul className="p-2 space-y-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <li key={i} className="px-2.5 py-2 flex items-center gap-2.5">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-44" />
                  </div>
                </li>
              ))}
            </ul>
          ) : hasError ? (
            <div className="p-3">
              <InlineEmpty text="Conversations could not load" />
            </div>
          ) : isTrueZero ? (
            <div className="p-3">
              <InlineEmpty text="No conversations yet" />
            </div>
          ) : isFilteredEmpty ? (
            <div className="p-3">
              <InlineEmpty text="No conversations here" />
            </div>
          ) : (
            <ul>
              {rows.map((row) => {
                const isActive = row.id === activeId
                const name = fullName(row)
                const seed = row.candidate?.id ?? row.id
                const color = avatarColor(seed)
                const stage = stageTone(row.stageName)
                const recruiter = row.recruiter
                const recruiterInitials = recruiter
                  ? initialsOf(
                      `${recruiter.first_name ?? ''} ${recruiter.last_name ?? ''}`.trim(),
                      '?',
                    )
                  : null
                const recruiterColor = recruiter ? avatarColor(recruiter.id) : null

                return (
                  <li key={row.id}>
                    <button
                      onClick={() => navigate(`/chat/${row.id}`)}
                      className="w-full text-left flex gap-3 transition-colors"
                      style={{
                        padding: '14px 16px',
                        borderLeft: `2px solid ${isActive ? '#6F3FF5' : 'transparent'}`,
                        background: isActive ? '#F1F0EC' : 'transparent',
                        transitionDuration: '150ms',
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) e.currentTarget.style.background = '#FAFAF7'
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) e.currentTarget.style.background = 'transparent'
                      }}
                    >
                      {/* Avatar block */}
                      <div className="relative shrink-0">
                        <div
                          className="flex items-center justify-center font-poppins font-semibold"
                          style={{
                            height: 40,
                            width: 40,
                            borderRadius: 999,
                            background: color.bg,
                            color: color.fg,
                            fontSize: 13,
                            letterSpacing: '-0.01em',
                          }}
                          aria-hidden
                        >
                          {initialsOf(name, '?')}
                        </div>
                        <ChannelDot channel={row.channel} />
                      </div>

                      {/* Content column */}
                      <div className="flex-1 min-w-0">
                        {/* Line 1 — name + time */}
                        <div className="flex items-baseline" style={{ gap: 8 }}>
                          <span
                            className="font-poppins font-semibold truncate"
                            style={{
                              fontSize: 13,
                              color: '#0d0d09',
                              letterSpacing: '-0.01em',
                            }}
                          >
                            {name}
                          </span>
                          <span
                            className="font-inter shrink-0 ml-auto tabular-nums"
                            style={{ fontSize: 10.5, color: '#8B8F9E' }}
                          >
                            {timeAgo(row.last_message_at)}
                          </span>
                        </div>

                        {/* Line 2 — role + stage */}
                        <div
                          className="flex items-center"
                          style={{ gap: 8, marginTop: 2, marginBottom: 5 }}
                        >
                          <span
                            className="font-inter truncate flex-1 min-w-0"
                            style={{ fontSize: 11, color: '#8B8F9E' }}
                          >
                            {jobLabel(row) || '\u00A0'}
                          </span>
                          {stage && row.stageName && (
                            <span
                              className="inline-flex items-center shrink-0 font-inter font-semibold"
                              style={{
                                padding: '1px 7px 1px 6px',
                                borderRadius: 999,
                                fontSize: 10,
                                gap: 4,
                                background: stage.bg,
                                color: stage.fg,
                              }}
                            >
                              <span
                                style={{
                                  height: 5,
                                  width: 5,
                                  borderRadius: 999,
                                  background: stage.dot,
                                  display: 'inline-block',
                                }}
                              />
                              {row.stageName}
                            </span>
                          )}
                        </div>

                        {/* Line 3 — preview + trailing marker */}
                        <div className="flex items-end" style={{ gap: 8 }}>
                          <span
                            className={cn('font-inter flex-1 min-w-0 line-clamp-2')}
                            style={{
                              fontSize: 12,
                              lineHeight: 1.4,
                              color: row.isUnread ? '#1F2230' : '#5A6072',
                              fontWeight: row.isUnread ? 500 : 400,
                            }}
                          >
                            {previewLabel(row)}
                          </span>
                          {row.isUnread ? (
                            <span
                              className="inline-flex items-center justify-center shrink-0 font-inter"
                              style={{
                                minWidth: 18,
                                height: 18,
                                padding: '0 5px',
                                borderRadius: 999,
                                background: '#6F3FF5',
                                color: '#FFFFFF',
                                fontWeight: 700,
                                fontSize: 10.5,
                              }}
                              aria-label={`${row.unreadCount || 1} unread messages`}
                            >
                              {row.unreadCount || 1}
                            </span>
                          ) : recruiterInitials && recruiterColor ? (
                            <span
                              className="inline-flex items-center justify-center shrink-0 font-poppins font-semibold"
                              title="Assigned recruiter"
                              style={{
                                height: 18,
                                width: 18,
                                borderRadius: 999,
                                background: recruiterColor.bg,
                                color: recruiterColor.fg,
                                fontSize: 9,
                                letterSpacing: '-0.01em',
                              }}
                            >
                              {recruiterInitials}
                            </span>
                          ) : null}
                        </div>
                      </div>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </aside>

      <NewMessageSheet open={composeOpen} onOpenChange={setComposeOpen} />
    </>
  )
}

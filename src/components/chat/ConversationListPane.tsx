import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { PenLine, Search } from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'
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

function initials(row: ChatThreadRow) {
  const name = row.candidate?.candidate_name?.trim()
  if (name) {
    const parts = name.split(/\s+/).filter(Boolean)
    const first = parts[0]?.[0] ?? ''
    const last = parts.length > 1 ? parts[parts.length - 1]?.[0] ?? '' : ''
    return (first + last).toUpperCase() || '?'
  }
  return row.candidate?.email?.[0]?.toUpperCase() || '?'
}

function fullName(row: ChatThreadRow) {
  return row.candidate?.candidate_name?.trim() || row.candidate?.email || 'Unknown candidate'
}

function roleLabel(row: ChatThreadRow) {
  return row.candidate?.role_current || row.candidate?.current_job_title || row.job?.title || ''
}

function previewLabel(row: ChatThreadRow) {
  const preview = row.last_message_preview?.trim()
  if (!preview) return 'No messages yet'
  return preview.replace(/\s+/g, ' ')
}

function timeAgo(iso: string | null) {
  if (!iso) return ''
  try {
    return formatDistanceToNowStrict(new Date(iso), { addSuffix: false }).replace(
      /( seconds?| minutes?| hours?| days?| months?| years?)/,
      (m) => m.trim()[0],
    )
  } catch {
    return ''
  }
}

/**
 * ConversationListPane — left conversation pane.
 * Scope comes from ?scope in the URL (set by the top-bar ChatHeaderSlot).
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
    setParams((prev) => {
      const next = new URLSearchParams(prev)
      next.delete('scope')
      return next
    }, { replace: true })
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
        className="hidden md:flex w-[320px] shrink-0 flex-col border-r border-virgilio-border bg-surface-primary"
        aria-label="Conversations"
      >
        {/* Header block */}
        <div className="px-4 pt-[18px] pb-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="font-poppins font-semibold text-[16px] tracking-[-0.02em] text-virgilio-text">
                Conversations
              </h2>
              <span
                className="inline-flex items-center justify-center min-w-[22px] h-[20px] px-1.5 rounded-full text-[11px] font-poppins font-medium text-[#5A6072] bg-[#F1F0EC]"
                aria-label={`${totalThreadCount} conversations`}
              >
                {totalThreadCount}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {isChatAdmin && <AdminChatAuditViewer />}
              <button
                type="button"
                onClick={() => setComposeOpen(true)}
                aria-label="New message"
                title="New message"
                className="h-[30px] w-[30px] inline-flex items-center justify-center rounded-lg bg-white border border-virgilio-border text-[#1F2230] hover:bg-[#FAFAF7] transition-colors"
              >
                <PenLine className="h-3.5 w-3.5" strokeWidth={1.9} />
              </button>
            </div>
          </div>

          <label className="flex items-center gap-2 h-[34px] px-2.5 rounded-[9px] bg-[#F6F5F1] focus-within:ring-2 focus-within:ring-virgilio-purple/25">
            <Search className="h-3.5 w-3.5 text-[#8B8F9E]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations"
              className="flex-1 bg-transparent outline-none text-[12.5px] placeholder:text-[#8B8F9E]"
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

        <div className="flex-1 overflow-auto border-t border-[#F1F0EC]">
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
            <ul className="p-2 space-y-1">
              {rows.map((row) => {
                const isActive = row.id === activeId
                return (
                  <li key={row.id}>
                    <button
                      onClick={() => navigate(`/chat/${row.id}`)}
                      className={cn(
                        'group relative w-full text-left rounded-[14px] pl-3 pr-3 py-3 flex items-start gap-3 transition-colors',
                        isActive
                          ? 'bg-[#F7F3FF] shadow-[inset_0_0_0_1px_rgba(110,80,200,0.08)] before:absolute before:left-0 before:top-3 before:bottom-3 before:w-[3px] before:bg-virgilio-purple before:rounded-r-full'
                          : 'hover:bg-[#FAFAF7]',
                      )}
                    >
                      <div className="relative shrink-0">
                        <div
                          className="h-11 w-11 rounded-full flex items-center justify-center text-[12.5px] font-poppins font-semibold tracking-[-0.02em] bg-[#EDE4FF] text-[#5B3FBF] overflow-hidden"
                          aria-hidden
                        >
                          {initials(row)}
                        </div>
                        <ChannelDot channel={row.channel} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={cn(
                              'font-poppins text-[13.5px] tracking-[-0.02em] truncate',
                              row.isUnread
                                ? 'font-semibold text-virgilio-text'
                                : 'font-medium text-virgilio-text',
                            )}
                          >
                            {fullName(row)}
                          </span>
                          <span className="text-[10.5px] text-[#8B8F9E] shrink-0 font-poppins font-medium tabular-nums">
                            {timeAgo(row.last_message_at)}
                          </span>
                        </div>
                        {roleLabel(row) && (
                          <div className="text-[11px] text-[#8B8F9E] truncate mt-[1px] font-inter">
                            {roleLabel(row)}
                          </div>
                        )}
                        <div className="flex items-end justify-between gap-2 mt-1">
                          <span
                            className={cn(
                              'text-[12px] leading-[1.3] line-clamp-2',
                              row.isUnread
                                ? 'text-virgilio-text font-medium'
                                : 'text-[#5A6072]',
                            )}
                          >
                            {previewLabel(row)}
                          </span>
                          {row.isUnread && (
                            <span
                              className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-virgilio-purple text-white text-[10px] font-poppins font-semibold shrink-0 mb-[1px]"
                              aria-label="Unread messages"
                            >
                              {row.unreadCount || 1}
                            </span>
                          )}
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

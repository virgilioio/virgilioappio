import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Search, Inbox } from 'lucide-react'
import { formatDistanceToNowStrict } from 'date-fns'
import { EmptyState } from '@/components/ui/empty-state'
import { SoftBubble } from '@/components/ui/EmptyIllustrations'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { ScopeTabs } from '@/components/chat/ScopeTabs'
import {
  useChatThreads,
  type ChatThreadRow,
  type ChatThreadScope,
} from '@/hooks/chat/useChatThreads'
import { ChatSlaWidget } from '@/components/chat/ChatSlaWidget'
import { AdminChatAuditViewer } from '@/components/chat/AdminChatAuditViewer'
import { usePermissions } from '@/hooks/usePermissions'

function initials(row: ChatThreadRow) {
  const f = row.candidate?.first_name?.[0] ?? ''
  const l = row.candidate?.last_name?.[0] ?? ''
  return (f + l).toUpperCase() || row.candidate?.email?.[0]?.toUpperCase() || '?'
}

function fullName(row: ChatThreadRow) {
  const name = `${row.candidate?.first_name ?? ''} ${row.candidate?.last_name ?? ''}`.trim()
  return name || row.candidate?.email || 'Unknown candidate'
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
 * ConversationListPane — real chat thread list with scope tabs + search (Step 1.5).
 */
export function ConversationListPane() {
  const navigate = useNavigate()
  const { threadId: activeId } = useParams<{ threadId: string }>()
  const { isPlatformAdmin, isWorkspaceOwner, isAdmin } = usePermissions()
  const isChatAdmin = isPlatformAdmin || isWorkspaceOwner || isAdmin
  const [scope, setScope] = useState<ChatThreadScope>('all')
  const [search, setSearch] = useState('')

  // All threads (for stable counts across tabs).
  const allQuery = useChatThreads({ scope: 'all', search: '' })
  const filteredQuery = useChatThreads({ scope, search })

  const counts = useMemo(() => {
    const rows = allQuery.data ?? []
    return {
      all: rows.length,
      unread: rows.filter((r) => r.isUnread).length,
      assigned: 0, // assigned count is auth-scoped; left to allQuery callers
    } as Partial<Record<ChatThreadScope, number>>
  }, [allQuery.data])

  const rows = filteredQuery.data ?? []
  const isLoading = filteredQuery.isLoading
  const isEmpty = !isLoading && rows.length === 0

  return (
    <aside
      className="hidden md:flex w-[320px] shrink-0 flex-col border-r border-virgilio-border bg-surface-primary"
      aria-label="Conversations"
    >
      <header className="flex items-center justify-between px-4 h-14 border-b border-virgilio-border">
        <h2 className="font-poppins font-semibold text-[15px] tracking-[-0.02em] text-virgilio-text">
          Chat<span className="text-[#d7c5fb]">.</span>
        </h2>
        {isChatAdmin && <AdminChatAuditViewer />}
      </header>

      {isChatAdmin && (
        <div className="px-4 pt-3">
          <ChatSlaWidget />
        </div>
      )}

      <div className="px-4 py-3 border-b border-virgilio-border space-y-2.5">
        <label className="flex items-center gap-2 h-8 px-2.5 rounded-md bg-surface-secondary focus-within:ring-2 focus-within:ring-virgilio-purple/30">
          <Search className="h-3.5 w-3.5 text-text-secondary" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by candidate or job"
            className="flex-1 bg-transparent outline-none text-[12.5px] placeholder:text-text-secondary"
            aria-label="Search conversations"
          />
        </label>
        <ScopeTabs value={scope} onChange={setScope} counts={counts} />
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <ul className="p-2 space-y-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <li key={i} className="px-2.5 py-2 flex items-center gap-2.5">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
              </li>
            ))}
          </ul>
        ) : isEmpty ? (
          <div className="p-4">
            {search || scope !== 'all' ? (
              <EmptyState
                variant="inline"
                size="sm"
                mascot={false}
                icon={Inbox}
                title="No matches"
                description="Try a different filter or search term."
              />
            ) : (
              <EmptyState
                size="card"
                illustration={<SoftBubble />}
                title="No conversations yet"
                body="When a candidate replies to a chat invite, the thread will land here."
              />
            )}
          </div>
        ) : (
          <ul className="p-2 space-y-0.5">
            {rows.map((row) => {
              const isActive = row.id === activeId
              return (
                <li key={row.id}>
                  <button
                    onClick={() => navigate(`/chat/${row.id}`)}
                    className={cn(
                      'w-full text-left rounded-lg px-2.5 py-2 flex items-start gap-2.5 transition-colors',
                      isActive
                        ? 'bg-[#FAF8FF] ring-1 ring-virgilio-purple/20'
                        : 'hover:bg-[#FAFAF7]',
                    )}
                  >
                    <div
                      className={cn(
                        'h-9 w-9 rounded-full flex items-center justify-center shrink-0 text-[12px] font-poppins font-semibold tracking-[-0.02em]',
                        'bg-[#EDE4FF] text-[#5B3FBF]',
                      )}
                      aria-hidden
                    >
                      {row.candidate?.avatar_url ? (
                        <img
                          src={row.candidate.avatar_url}
                          alt=""
                          className="h-9 w-9 rounded-full object-cover"
                        />
                      ) : (
                        initials(row)
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span
                          className={cn(
                            'font-poppins text-[13px] tracking-[-0.01em] truncate',
                            row.isUnread
                              ? 'font-semibold text-virgilio-text'
                              : 'font-medium text-virgilio-text',
                          )}
                        >
                          {fullName(row)}
                        </span>
                        <span className="text-[10.5px] text-text-secondary shrink-0 font-mono">
                          {timeAgo(row.last_message_at)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 mt-0.5">
                        <span
                          className={cn(
                            'text-[12px] truncate',
                            row.isUnread ? 'text-virgilio-text' : 'text-text-secondary',
                          )}
                        >
                          {row.last_message_preview || 'No messages yet'}
                        </span>
                        {row.isUnread && (
                          <span
                            className="h-1.5 w-1.5 rounded-full bg-virgilio-purple shrink-0"
                            aria-label="Unread"
                          />
                        )}
                      </div>
                      {row.job?.title && (
                        <div className="text-[10.5px] text-text-secondary truncate mt-0.5 font-inter">
                          {row.job.title}
                        </div>
                      )}
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </aside>
  )
}

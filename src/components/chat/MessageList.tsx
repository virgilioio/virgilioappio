import { useEffect, useMemo, useRef, type ReactNode } from 'react'
import { format } from 'date-fns'
import { MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/ui/empty-state'
import { MessageBubble } from '@/components/chat/MessageBubble'
import { DaySeparator } from '@/components/chat/DaySeparator'
import { useChatMessages, type ChatMessageRow } from '@/hooks/chat/useChatMessages'

interface MessageListProps {
  threadId: string
  /** Optional slot rendered at the very top of the scroll area (e.g. AI summary card). */
  topSlot?: ReactNode
}

/**
 * MessageList — scrolls messages oldest→newest, groups by day, auto-scrolls to bottom.
 * Spec padding: 20px 22px 8px, warm off-white surface (owned by the parent).
 */
export function MessageList({ threadId, topSlot }: MessageListProps) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useChatMessages(threadId)

  const messages = useMemo<ChatMessageRow[]>(() => (data?.pages ?? []).flat(), [data])

  const scrollRef = useRef<HTMLDivElement>(null)
  const lastIdRef = useRef<string | null>(null)

  useEffect(() => {
    const last = messages[messages.length - 1]
    if (!last || !scrollRef.current) return
    if (lastIdRef.current === last.id) return
    lastIdRef.current = last.id
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  if (isLoading) {
    return (
      <div
        className="flex-1 overflow-auto"
        style={{ padding: '20px 22px 8px' }}
      >
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-2/3 rounded-2xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-auto"
      style={{ padding: '20px 22px 8px' }}
    >
      {topSlot}
      {hasNextPage && (
        <div className="flex justify-center pb-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
          >
            {isFetchingNextPage ? 'Loading…' : 'Load earlier messages'}
          </Button>
        </div>
      )}
      {messages.length === 0 ? (
        <div className="flex items-center justify-center py-14">
          <EmptyState
            variant="inline"
            mascot={false}
            icon={MessageSquare}
            title="No messages yet"
            description="Send the first message to start the conversation."
          />
        </div>
      ) : (
        messages.map((m, idx) => {
          const prev = messages[idx - 1]
          const showSeparator =
            !prev ||
            format(new Date(prev.created_at), 'yyyy-MM-dd') !==
              format(new Date(m.created_at), 'yyyy-MM-dd')
          return (
            <div key={m.id}>
              {showSeparator && <DaySeparator date={m.created_at} />}
              <MessageBubble message={m} />
            </div>
          )
        })
      )}
    </div>
  )
}

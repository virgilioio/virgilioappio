import { useEffect, useMemo, useRef } from 'react'
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
}

/**
 * MessageList — renders messages oldest→newest with day separators and infinite loading (Step 1.6).
 */
export function MessageList({ threadId }: MessageListProps) {
  const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useChatMessages(threadId)

  const messages = useMemo<ChatMessageRow[]>(
    () => (data?.pages ?? []).flat(),
    [data],
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const lastIdRef = useRef<string | null>(null)

  // Auto-scroll to bottom when a new latest message appears.
  useEffect(() => {
    const last = messages[messages.length - 1]
    if (!last || !scrollRef.current) return
    if (lastIdRef.current === last.id) return
    lastIdRef.current = last.id
    scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages])

  if (isLoading) {
    return (
      <div className="flex-1 overflow-auto p-6 space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-2/3 rounded-2xl" />
        ))}
      </div>
    )
  }

  if (messages.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <EmptyState
          variant="inline"
          mascot={false}
          icon={MessageSquare}
          title="No messages yet"
          description="Send the first message to start the conversation."
        />
      </div>
    )
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-auto px-5 py-4">
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
      {messages.map((m, idx) => {
        const prev = messages[idx - 1]
        const showSeparator =
          !prev || format(new Date(prev.created_at), 'yyyy-MM-dd') !==
            format(new Date(m.created_at), 'yyyy-MM-dd')
        return (
          <div key={m.id}>
            {showSeparator && <DaySeparator date={m.created_at} />}
            <MessageBubble message={m} />
          </div>
        )
      })}
    </div>
  )
}

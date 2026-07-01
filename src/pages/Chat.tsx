import { useParams } from 'react-router-dom'
import { ConversationListPane } from '@/components/chat/ConversationListPane'
import { ThreadPane } from '@/components/chat/ThreadPane'
import { ContextPane } from '@/components/chat/ContextPane'
import { useChatRealtime } from '@/hooks/chat/useChatRealtime'

/**
 * Chat — module shell.
 * White rounded content frame wraps the list + thread panes.
 * ContextPane only mounts when a conversation is selected.
 */
export default function Chat() {
  const { threadId } = useParams<{ threadId: string }>()
  useChatRealtime({ activeThreadId: threadId })

  return (
    <div className="h-[calc(100dvh-4rem)] w-full" style={{ background: '#F6F5F1' }}>
      <div
        className="flex h-full w-full overflow-hidden bg-white"
        style={{
          borderRadius: 16,
          border: '1px solid #E7E8EE',
        }}
      >
        <ConversationListPane />
        <ThreadPane threadId={threadId} />
        {threadId && <ContextPane threadId={threadId} />}
      </div>
    </div>
  )
}

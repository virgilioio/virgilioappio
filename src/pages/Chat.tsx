import { useParams } from 'react-router-dom'
import { ConversationListPane } from '@/components/chat/ConversationListPane'
import { ThreadPane } from '@/components/chat/ThreadPane'
import { ContextPane } from '@/components/chat/ContextPane'
import { useChatRealtime } from '@/hooks/chat/useChatRealtime'

/**
 * Chat — 3-pane workspace shell (Step 1.4).
 * Layout: List (320px) · Thread (flexible) · Context (304px).
 */
export default function Chat() {
  const { threadId } = useParams<{ threadId: string }>()
  useChatRealtime({ activeThreadId: threadId })

  return (
    <div className="flex h-[calc(100dvh-4rem)] w-full bg-surface-secondary">
      <ConversationListPane />
      <ThreadPane threadId={threadId} />
      <ContextPane threadId={threadId} />
    </div>
  )
}

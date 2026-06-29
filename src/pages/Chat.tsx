import { EmptyState } from '@/components/ui/empty-state'
import { SoftBubble } from '@/components/ui/EmptyIllustrations'

export default function Chat() {
  return (
    <div className="p-6">
      <EmptyState
        size="route"
        illustration={<SoftBubble />}
        title="Chat"
        body="Message candidates in real time. Conversations will appear here once you start a thread."
      />
    </div>
  )
}

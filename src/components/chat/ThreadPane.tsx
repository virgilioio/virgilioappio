import { MessageSquare } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { SoftBubble } from '@/components/ui/EmptyIllustrations'

interface ThreadPaneProps {
  threadId?: string
}

/**
 * ThreadPane — placeholder shell (Step 1.4).
 * Header, message list, and composer wire up in Steps 1.6/1.7.
 */
export function ThreadPane({ threadId }: ThreadPaneProps) {
  return (
    <section className="flex-1 min-w-0 flex flex-col bg-surface-primary" aria-label="Thread">
      {threadId ? (
        <>
          <header className="flex items-center h-14 px-5 border-b border-virgilio-border">
            <div className="text-[13px] text-text-secondary font-mono">{threadId}</div>
          </header>
          <div className="flex-1 overflow-auto flex items-center justify-center p-6">
            <EmptyState
              variant="inline"
              mascot={false}
              icon={MessageSquare}
              title="Thread shell ready"
              description="Messages will render here in Step 1.6."
            />
          </div>
          <footer className="border-t border-virgilio-border p-4">
            <div className="h-[88px] rounded-lg border border-dashed border-virgilio-border bg-surface-secondary flex items-center justify-center text-[12.5px] text-text-secondary">
              Composer — wired in Step 1.7
            </div>
          </footer>
        </>
      ) : (
        <div className="flex-1 flex items-center justify-center p-8">
          <EmptyState
            size="route"
            illustration={<SoftBubble />}
            title="Select a conversation"
            body="Pick a candidate thread on the left to start messaging. New incoming chats will appear here."
          />
        </div>
      )}
    </section>
  )
}

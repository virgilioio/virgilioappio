import { useParams } from 'react-router-dom'
import { Search, Inbox, MessageSquare, User2 } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'
import { SoftBubble } from '@/components/ui/EmptyIllustrations'

/**
 * Chat — 3-pane workspace shell (Step 1.4).
 * Layout: List (320px) · Thread (flexible) · Context (304px).
 * No data yet — each pane shows its canonical empty state.
 */
export default function Chat() {
  const { threadId } = useParams<{ threadId: string }>()

  return (
    <div className="flex h-[calc(100dvh-4rem)] w-full bg-surface-secondary">
      {/* Pane 1 — Conversation list (320px) */}
      <aside
        className="hidden md:flex w-[320px] shrink-0 flex-col border-r border-virgilio-border bg-surface-primary"
        aria-label="Conversations"
      >
        <header className="flex items-center justify-between px-4 h-14 border-b border-virgilio-border">
          <h2 className="font-poppins font-semibold text-[15px] tracking-[-0.02em] text-virgilio-text">
            Chat<span className="text-[#d7c5fb]">.</span>
          </h2>
        </header>
        <div className="px-4 py-3 border-b border-virgilio-border">
          <div className="flex items-center gap-2 h-8 px-2.5 rounded-md bg-surface-secondary text-text-secondary text-[12.5px]">
            <Search className="h-3.5 w-3.5" />
            <span>Search conversations</span>
          </div>
        </div>
        <div className="flex-1 overflow-auto p-4">
          <EmptyState
            variant="inline"
            size="sm"
            mascot={false}
            icon={Inbox}
            title="No conversations yet"
            description="Active candidate threads will appear here."
          />
        </div>
      </aside>

      {/* Pane 2 — Thread (flexible) */}
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

      {/* Pane 3 — Context (304px) */}
      <aside
        className="hidden xl:flex w-[304px] shrink-0 flex-col border-l border-virgilio-border bg-surface-primary"
        aria-label="Candidate context"
      >
        <header className="flex items-center h-14 px-4 border-b border-virgilio-border">
          <h3 className="font-poppins font-semibold text-[13px] tracking-[-0.02em] text-virgilio-text">
            Context<span className="text-[#d7c5fb]">.</span>
          </h3>
        </header>
        <div className="flex-1 overflow-auto p-4">
          <EmptyState
            variant="inline"
            size="sm"
            mascot={false}
            icon={User2}
            title="No candidate selected"
            description="Snapshot and pipeline appear once a thread is open."
          />
        </div>
      </aside>
    </div>
  )
}

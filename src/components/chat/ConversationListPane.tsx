import { Search, Inbox } from 'lucide-react'
import { EmptyState } from '@/components/ui/empty-state'

/**
 * ConversationListPane — placeholder shell (Step 1.4).
 * Real list, scope tabs, filters, and search arrive in Step 1.5.
 */
export function ConversationListPane() {
  return (
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
  )
}

import { cn } from '@/lib/utils'
import type { ChatThreadScope } from '@/hooks/chat/useChatThreads'

interface ScopeTabsProps {
  value: ChatThreadScope
  onChange: (next: ChatThreadScope) => void
  counts?: Partial<Record<ChatThreadScope, number>>
}

const TABS: { id: ChatThreadScope; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'assigned', label: 'Assigned' },
]

/**
 * ScopeTabs — segmented control for filtering chat threads (Step 1.5).
 */
export function ScopeTabs({ value, onChange, counts }: ScopeTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Conversation scope"
      className="inline-flex items-center gap-1 p-1 rounded-lg bg-surface-secondary"
    >
      {TABS.map((tab) => {
        const active = tab.id === value
        const count = counts?.[tab.id]
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={cn(
              'h-7 px-2.5 rounded-md font-poppins text-[12px] font-medium tracking-[-0.01em] transition-colors',
              'flex items-center gap-1.5',
              active
                ? 'bg-surface-primary text-virgilio-text shadow-[0_1px_2px_rgba(13,13,9,0.06)]'
                : 'text-text-secondary hover:text-virgilio-text',
            )}
          >
            <span>{tab.label}</span>
            {typeof count === 'number' && count > 0 && (
              <span
                className={cn(
                  'inline-flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-semibold',
                  active ? 'bg-[#EDE4FF] text-[#5B3FBF]' : 'bg-surface-primary text-text-secondary',
                )}
              >
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}

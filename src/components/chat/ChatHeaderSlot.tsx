import { useSearchParams } from 'react-router-dom'
import { MessagesSquare } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatThreadScope } from '@/hooks/chat/useChatThreads'

const SEGMENTS: { id: ChatThreadScope; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'assigned', label: 'Assigned to me' },
]

/**
 * ChatHeaderSlot — rendered inside the shared dark Header on /chat routes.
 * Shows the Chat module label and the scope segmented control.
 * Scope lives in the URL as ?scope=all|unread|assigned so any pane can read it.
 */
export function ChatHeaderSlot() {
  const [params, setParams] = useSearchParams()
  const scope = (params.get('scope') as ChatThreadScope) || 'all'

  const setScope = (next: ChatThreadScope) => {
    const p = new URLSearchParams(params)
    if (next === 'all') p.delete('scope')
    else p.set('scope', next)
    setParams(p, { replace: true })
  }

  return (
    <div className="flex items-center gap-3 min-w-0">
      <div className="flex items-center gap-2 pl-1 pr-1">
        <MessagesSquare className="h-3.5 w-3.5 text-[#fffcf9]" />
        <span className="font-poppins font-semibold text-[13.5px] tracking-[-0.01em] text-[#fffcf9]">
          Chat
        </span>
      </div>
      <div
        role="tablist"
        aria-label="Chat scope"
        className="inline-flex items-center gap-0.5 p-[3px] rounded-[9px]"
        style={{ background: 'rgba(255,255,255,0.06)' }}
      >
        {SEGMENTS.map((seg) => {
          const active = seg.id === scope
          return (
            <button
              key={seg.id}
              role="tab"
              aria-selected={active}
              onClick={() => setScope(seg.id)}
              className={cn(
                'h-6 px-2.5 rounded-[7px] font-poppins text-[12px] tracking-[-0.005em] transition-colors',
                active
                  ? 'bg-[#fffcf9] text-[#0d0d09] font-semibold'
                  : 'text-white/70 font-medium hover:text-white',
              )}
            >
              {seg.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

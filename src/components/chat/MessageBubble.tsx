import { format } from 'date-fns'
import { Lock, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ChatMessageRow } from '@/hooks/chat/useChatMessages'

interface MessageBubbleProps {
  message: ChatMessageRow
}

/**
 * MessageBubble — chat bubble with variants for inbound / outbound / internal note (Step 1.6).
 */
export function MessageBubble({ message }: MessageBubbleProps) {
  const isNote = message.direction === 'note'
  const isOutbound = message.direction === 'out'
  const isAi = message.sender_type === 'ai'
  const time = message.created_at ? format(new Date(message.created_at), 'h:mm a') : ''

  if (isNote) {
    return (
      <div className="my-2 px-3 py-2 rounded-lg border border-[#FCE7AC] bg-[#FFF8E1]">
        <div className="flex items-center gap-1.5 mb-1 text-[10.5px] font-poppins font-semibold tracking-[0.04em] uppercase text-[#8A6D1F]">
          <Lock className="h-3 w-3" />
          Internal note
          <span className="ml-auto font-mono text-[10.5px] tracking-normal normal-case text-[#8A6D1F]/70">
            {time}
          </span>
        </div>
        <p className="text-[13px] leading-[1.45] text-[#5C4A14] whitespace-pre-wrap break-words">
          {message.body}
        </p>
      </div>
    )
  }

  return (
    <div className={cn('flex w-full my-1', isOutbound ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[78%] flex flex-col', isOutbound ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'px-3 py-2 rounded-2xl text-[13.5px] leading-[1.45] whitespace-pre-wrap break-words',
            isOutbound
              ? 'bg-[#0d0d09] text-[#FFFCF9] rounded-br-md'
              : 'bg-[#F1F0EC] text-virgilio-text rounded-bl-md',
            message._optimistic && 'opacity-70',
          )}
        >
          {message.body}
        </div>
        <div className="flex items-center gap-1.5 mt-1 px-1 text-[10.5px] text-text-secondary font-mono">
          {isAi && (
            <span className="inline-flex items-center gap-1 text-[#5B3FBF] font-poppins font-medium tracking-[-0.01em]">
              <Sparkles className="h-3 w-3" />
              Gio
            </span>
          )}
          <span>{time}</span>
          {message._optimistic && <span>· Sending…</span>}
        </div>
      </div>
    </div>
  )
}

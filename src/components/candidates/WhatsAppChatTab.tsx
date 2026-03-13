import { useRef, useEffect } from 'react'
import { Loader2, MessageSquare, Wifi, Lock } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  useWhatsAppConversation,
  useWhatsAppMessages,
  useMarkWhatsAppRead,
} from '@/hooks/useWhatsApp'
import { useWhatsAppSessionState, type WhatsAppSessionStatus } from '@/hooks/useWhatsAppConfig'
import { WhatsAppConnectionBadge, WhatsAppStatusDot } from '@/components/whatsapp/WhatsAppConnectionBadge'
import { WhatsAppInboxEmptyState } from '@/components/whatsapp/WhatsAppInboxEmptyState'
import { cn } from '@/lib/utils'
import whatsappBg from '@/assets/whatsapp-chat-bg.png'

interface WhatsAppChatTabProps {
  candidateId: string
  jobId?: string
  phoneNumber?: string
  candidateName: string
  companyName?: string
  jobTitle?: string
  recruiterName?: string
}

export function WhatsAppChatTab({
  candidateId,
  jobId,
  phoneNumber,
  candidateName,
}: WhatsAppChatTabProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const { data: conversation } = useWhatsAppConversation(candidateId, jobId)
  const { data: messages = [], isLoading } = useWhatsAppMessages(conversation?.id)
  const markRead = useMarkWhatsAppRead()
  const sessionState = useWhatsAppSessionState()

  const targetPhone = phoneNumber || conversation?.phone_number

  // Mark as read when conversation opens
  useEffect(() => {
    if (conversation?.id && conversation.unread_count > 0) {
      markRead.mutate(conversation.id)
    }
  }, [conversation?.id, conversation?.unread_count])

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  // Show appropriate empty state for non-connected statuses
  if (!sessionState.isLoading && !sessionState.canSync) {
    return (
      <WhatsAppInboxEmptyState
        sessionStatus={sessionState.status}
        context="candidate"
        candidateName={candidateName}
      />
    )
  }

  if (!targetPhone) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
        <MessageSquare className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">No phone number</p>
        <p className="text-xs text-muted-foreground mt-1">
          Add a phone number to this candidate to see WhatsApp conversations.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="px-4 py-2 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-2">
          <WhatsAppStatusDot status={sessionState.status} />
          <span className="text-xs text-muted-foreground">
            WhatsApp · {targetPhone}
          </span>
        </div>
        <WhatsAppConnectionBadge status={sessionState.status} />
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 relative" ref={scrollRef}>
        <div
          className="absolute inset-0 bg-cover bg-center pointer-events-none"
          style={{ backgroundImage: `url(${whatsappBg})` }}
        />
        <div className="relative px-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="h-6 w-6 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">
              No WhatsApp messages with {candidateName} yet. Messages will appear here once synced.
            </p>
          </div>
        ) : (
          <div className="space-y-3 py-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  'max-w-[80%] rounded-lg px-3 py-2',
                  msg.direction === 'outbound'
                    ? 'ml-auto bg-[#dcf8c6] text-foreground'
                    : 'mr-auto bg-white text-foreground shadow-sm'
                )}
              >
                <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </span>
                  {msg.direction === 'outbound' && (
                    <span className={cn(
                      "text-[10px] capitalize",
                      msg.status === 'failed' || msg.status === 'undelivered'
                        ? 'text-destructive font-medium'
                        : 'text-muted-foreground'
                    )}>
                      · {msg.status === 'failed' || msg.status === 'undelivered' ? '⚠ ' + msg.status : msg.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        </div>
      </ScrollArea>

      {/* Composer — gated until provider is ready */}
      <div className="border-t border-border p-3">
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/30 border border-border">
          <Lock className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            Sending messages from GoGio will be available once WhatsApp sync is fully configured. Reply directly in WhatsApp for now.
          </p>
        </div>
      </div>
    </div>
  )
}

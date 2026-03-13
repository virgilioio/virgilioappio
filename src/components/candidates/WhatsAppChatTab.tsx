import { useRef, useEffect } from 'react'
import { Loader2, MessageSquare, Settings, Wifi, WifiOff } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  useWhatsAppConversation,
  useWhatsAppMessages,
  useMarkWhatsAppRead,
} from '@/hooks/useWhatsApp'
import { useWhatsAppConnectionState } from '@/hooks/useWhatsAppConfig'
import { cn } from '@/lib/utils'
import whatsappBg from '@/assets/whatsapp-chat-bg.png'
import { useNavigate } from 'react-router-dom'

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
  const navigate = useNavigate()
  const { data: conversation } = useWhatsAppConversation(candidateId, jobId)
  const { data: messages = [], isLoading } = useWhatsAppMessages(conversation?.id)
  const markRead = useMarkWhatsAppRead()
  const connectionState = useWhatsAppConnectionState()

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

  // Not connected
  if (!connectionState.isLoading && connectionState.status === 'disconnected') {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
        <WifiOff className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">WhatsApp not connected</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
          Connect your WhatsApp in Settings to sync conversations with candidates.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="mt-4"
          onClick={() => navigate('/settings?tab=integrations')}
        >
          <Settings className="h-3.5 w-3.5 mr-1.5" />
          Connect WhatsApp
        </Button>
      </div>
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
          <div className={cn(
            'h-2 w-2 rounded-full',
            connectionState.status === 'connected' ? 'bg-[#25D366]' : 'bg-muted-foreground'
          )} />
          <span className="text-xs text-muted-foreground">
            WhatsApp · {targetPhone}
          </span>
        </div>
        {connectionState.status === 'connected' ? (
          <Badge variant="outline" className="text-[10px] border-[#25D366]/30 text-[#25D366]">
            <Wifi className="h-2.5 w-2.5 mr-1" />
            Synced
          </Badge>
        ) : connectionState.status === 'expired' ? (
          <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600">
            Session expired
          </Badge>
        ) : null}
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

      {/* Info footer — messaging happens in WhatsApp directly */}
      <div className="border-t border-border p-3">
        <p className="text-xs text-muted-foreground text-center">
          Messages are synced from your connected WhatsApp. Reply directly in WhatsApp.
        </p>
      </div>
    </div>
  )
}

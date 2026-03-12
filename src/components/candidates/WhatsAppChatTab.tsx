import { useState, useRef, useEffect } from 'react'
import { Send, Loader2, MessageSquare } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  useWhatsAppConversation,
  useWhatsAppMessages,
  useSendWhatsAppMessage,
  useMarkWhatsAppRead,
} from '@/hooks/useWhatsApp'
import { cn } from '@/lib/utils'

interface WhatsAppChatTabProps {
  candidateId: string
  jobId?: string
  phoneNumber?: string
  candidateName: string
}

export function WhatsAppChatTab({ candidateId, jobId, phoneNumber, candidateName }: WhatsAppChatTabProps) {
  const [message, setMessage] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const { data: conversation } = useWhatsAppConversation(candidateId, jobId)
  const { data: messages = [], isLoading } = useWhatsAppMessages(conversation?.id)
  const sendMessage = useSendWhatsAppMessage()
  const markRead = useMarkWhatsAppRead()

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

  const handleSend = async () => {
    if (!message.trim() || !targetPhone) return

    try {
      await sendMessage.mutateAsync({
        to: targetPhone,
        body: message.trim(),
        candidate_id: candidateId,
        job_id: jobId,
      })
      setMessage('')
    } catch (error) {
      // Error handled by mutation
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!targetPhone) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center px-4">
        <MessageSquare className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">No phone number</p>
        <p className="text-xs text-muted-foreground mt-1">
          Add a phone number to this candidate to start a WhatsApp conversation.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="px-4 py-2 border-b border-border flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-[#25D366]" />
        <span className="text-xs text-muted-foreground">
          WhatsApp · {targetPhone}
        </span>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <MessageSquare className="h-6 w-6 text-muted-foreground mb-2" />
            <p className="text-xs text-muted-foreground">
              No messages yet. Send a WhatsApp message to {candidateName}.
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
                    ? 'ml-auto bg-[#25D366]/10 text-foreground'
                    : 'mr-auto bg-muted text-foreground'
                )}
              >
                <p className="text-sm whitespace-pre-wrap break-words">{msg.body}</p>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] text-muted-foreground">
                    {formatDistanceToNow(new Date(msg.created_at), { addSuffix: true })}
                  </span>
                  {msg.direction === 'outbound' && (
                    <span className="text-[10px] text-muted-foreground capitalize">
                      · {msg.status}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Compose area */}
      <div className="border-t border-border p-3">
        <div className="flex gap-2">
          <Textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Message ${candidateName}...`}
            className="min-h-[40px] max-h-[120px] resize-none text-sm"
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!message.trim() || sendMessage.isPending}
            className="shrink-0 bg-[#25D366] hover:bg-[#25D366]/90 text-white"
          >
            {sendMessage.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  )
}

import { useState } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { MessageSquare, Loader2, User } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useWhatsAppJobConversations } from '@/hooks/useWhatsApp'
import { WhatsAppChatTab } from '@/components/candidates/WhatsAppChatTab'
import { cn } from '@/lib/utils'
import gioEmpty from '@/assets/gio-empty-state.png'

interface WhatsAppConversationsListProps {
  jobId: string
  onOpenCandidate?: (candidateId: string) => void
}

export function WhatsAppConversationsList({ jobId, onOpenCandidate }: WhatsAppConversationsListProps) {
  const { data: conversations = [], isLoading } = useWhatsAppJobConversations(jobId)
  const [selectedConvId, setSelectedConvId] = useState<string | null>(null)

  const selectedConv = conversations.find(c => c.id === selectedConvId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 bg-card rounded-lg border border-border shadow-sm">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-card rounded-lg border border-border shadow-sm">
        <img src={gioEmpty} alt="No conversations" className="h-24 w-24 mb-4 opacity-80" />
        <p className="text-base font-semibold text-foreground">No WhatsApp conversations yet</p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs text-center">
          Start a conversation from a candidate's profile to see it here.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-[calc(100vh-220px)] bg-card rounded-lg border border-border shadow-sm overflow-hidden">
      {/* Left panel — conversation list */}
      <div className="w-80 flex-shrink-0 border-r border-border flex flex-col">
        <div className="px-4 py-3 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm text-foreground">Conversations</h3>
            <Badge variant="secondary" className="text-xs">
              {conversations.length}
            </Badge>
          </div>
        </div>
        <ScrollArea className="flex-1">
          <div className="py-1">
            {conversations.map((conv) => {
              const isSelected = selectedConvId === conv.id
              const name = conv.candidates?.candidate_name || 'Unknown'
              const initials = name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedConvId(conv.id)}
                  className={cn(
                    "w-full text-left px-4 py-3 transition-colors flex items-start gap-3",
                    isSelected
                      ? "bg-accent"
                      : "hover:bg-muted/50"
                  )}
                >
                  {/* Avatar */}
                  <div className={cn(
                    "h-9 w-9 rounded-full flex items-center justify-center text-xs font-semibold shrink-0",
                    isSelected
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  )}>
                    {initials}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {name}
                      </span>
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                        {conv.last_message_at
                          ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })
                          : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 mt-0.5">
                      {conv.last_message_preview && (
                        <p className="text-xs text-muted-foreground truncate">
                          {conv.last_message_preview}
                        </p>
                      )}
                      {conv.unread_count > 0 && (
                        <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px] shrink-0">
                          {conv.unread_count}
                        </Badge>
                      )}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Right panel — chat or empty state */}
      <div className="flex-1 flex flex-col min-w-0">
        {selectedConv ? (
          <WhatsAppChatTab
            candidateId={selectedConv.candidate_id}
            jobId={jobId}
            phoneNumber={selectedConv.candidates?.contact_phone || undefined}
            candidateName={selectedConv.candidates?.candidate_name || 'Unknown'}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8">
            <img src={gioEmpty} alt="Select a conversation" className="h-28 w-28 mb-5 opacity-70" />
            <p className="text-base font-semibold text-foreground">
              Select a conversation
            </p>
            <p className="text-sm text-muted-foreground mt-1 max-w-sm">
              Pick a conversation from the list to start chatting with a candidate via WhatsApp.
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

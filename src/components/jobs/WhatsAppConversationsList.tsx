import { formatDistanceToNow } from 'date-fns'
import { MessageSquare, Loader2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useWhatsAppJobConversations } from '@/hooks/useWhatsApp'

interface WhatsAppConversationsListProps {
  jobId: string
  onOpenCandidate?: (candidateId: string) => void
}

export function WhatsAppConversationsList({ jobId, onOpenCandidate }: WhatsAppConversationsListProps) {
  const { data: conversations = [], isLoading } = useWhatsAppJobConversations(jobId)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (conversations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center px-4">
        <MessageSquare className="h-8 w-8 text-muted-foreground mb-3" />
        <p className="text-sm font-medium text-foreground">No WhatsApp conversations</p>
        <p className="text-xs text-muted-foreground mt-1">
          Start a conversation from a candidate's profile to see it here.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-sm text-foreground">WhatsApp Conversations</h3>
        <Badge variant="secondary" className="text-xs">
          {conversations.length}
        </Badge>
      </div>
      <ScrollArea className="h-[calc(100vh-280px)]">
        <div className="space-y-1">
          {conversations.map((conv) => (
            <button
              key={conv.id}
              onClick={() => onOpenCandidate?.(conv.candidate_id)}
              className="w-full text-left px-3 py-3 rounded-lg hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-foreground truncate">
                      {conv.candidates?.candidate_name || 'Unknown'}
                    </span>
                    {conv.unread_count > 0 && (
                      <Badge variant="destructive" className="h-4 min-w-4 px-1 text-[10px]">
                        {conv.unread_count}
                      </Badge>
                    )}
                  </div>
                  {conv.last_message_preview && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {conv.last_message_preview}
                    </p>
                  )}
                </div>
                <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
                  {conv.last_message_at
                    ? formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true })
                    : ''}
                </span>
              </div>
            </button>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}

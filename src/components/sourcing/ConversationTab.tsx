import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { useConversationHistory } from '@/hooks/useConversationHistory';
import { useRefineSearch } from '@/hooks/useRefineSearch';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import gioAvatar from '@/assets/gio-avatar.png';

interface ConversationTabProps {
  projectId: string;
  onRefinementComplete?: () => void;
}

export function ConversationTab({ projectId, onRefinementComplete }: ConversationTabProps) {
  const [inputMessage, setInputMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { data, isLoading: historyLoading } = useConversationHistory(projectId);
  const refineMutation = useRefineSearch();

  const messages = data?.messages || [];
  const hasConversation = data?.conversation !== null;

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || refineMutation.isPending) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');

    // Build conversation history (exclude system messages for context)
    const conversationHistory = messages
      .filter(m => m.role !== 'system')
      .map(m => ({ role: m.role, content: m.content }));

    await refineMutation.mutateAsync({
      projectId,
      userMessage,
      conversationHistory
    });

    onRefinementComplete?.();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Submit on Enter (without Shift) or Cmd/Ctrl+Enter
    if ((e.key === 'Enter' && !e.shiftKey) || ((e.metaKey || e.ctrlKey) && e.key === 'Enter')) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (historyLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface-primary">
      {/* Messages Container */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Welcome message when no conversation history */}
        {messages.length === 0 && !refineMutation.isPending && (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center">
            <img src={gioAvatar} alt="Gio" className="h-16 w-16 rounded-full mb-4" />
            <h3 className="text-lg font-semibold mb-2">Chat with Gio</h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Need to adjust your search? Tell me what you want to change — 
              add skills, change locations, update experience requirements, or anything else.
            </p>
          </div>
        )}

        {messages.map((message, index) => {
          // Skip system messages in UI
          if (message.role === 'system') return null;

          const isUser = message.role === 'user';
          const isAssistant = message.role === 'assistant';

          return (
            <div
              key={message.id}
              className={cn(
                'flex gap-3',
                isUser ? 'flex-row-reverse' : 'flex-row'
              )}
            >
              {/* Avatar */}
              <Avatar className="h-8 w-8 flex-shrink-0">
                {isAssistant ? (
                  <img src={gioAvatar} alt="Gio" className="h-full w-full object-cover" />
                ) : (
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    <User className="h-4 w-4" />
                  </AvatarFallback>
                )}
              </Avatar>

              {/* Message Content */}
              <div className={cn(
                'flex flex-col gap-1 max-w-[70%]',
                isUser && 'items-end'
              )}>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-medium">
                    {isAssistant ? 'Gio' : 'You'}
                  </span>
                  <span>·</span>
                  <span>{formatDistanceToNow(new Date(message.created_at), { addSuffix: true })}</span>
                </div>
                
                <div className={cn(
                  'rounded-2xl px-4 py-3 whitespace-pre-wrap',
                  isUser 
                    ? 'bg-primary text-primary-foreground' 
                    : 'bg-muted text-foreground'
                )}>
                  {message.content}
                </div>

                {/* Show metadata for assistant messages with job spec */}
                {isAssistant && message.metadata?.jobSpec && (
                  <div className="mt-2 p-3 rounded-lg bg-card border border-border text-sm space-y-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <Sparkles className="h-3 w-3" />
                      Job Specification Created
                    </div>
                    {message.metadata.jobSpec.skills && (
                      <div>
                        <span className="font-medium">Skills: </span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {message.metadata.jobSpec.skills.slice(0, 5).map((skill: string) => (
                            <Badge key={skill} variant="secondary" className="text-xs">
                              {skill}
                            </Badge>
                          ))}
                          {message.metadata.jobSpec.skills.length > 5 && (
                            <Badge variant="outline" className="text-xs">
                              +{message.metadata.jobSpec.skills.length - 5} more
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Loading indicator for refinement */}
        {refineMutation.isPending && (
          <div className="flex gap-3">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <img src={gioAvatar} alt="Gio" className="h-full w-full object-cover" />
            </Avatar>
            <div className="rounded-2xl px-4 py-3 bg-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t border-border bg-surface-primary p-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex gap-2 items-end">
            <Textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Refine your search criteria... (e.g., 'Add React and Node.js skills' or 'Change location to San Francisco')"
              className="min-h-[60px] max-h-[200px] resize-none"
              disabled={refineMutation.isPending}
            />
            <Button
              onClick={handleSendMessage}
              disabled={!inputMessage.trim() || refineMutation.isPending}
              size="icon"
              className="h-[60px] w-[60px] flex-shrink-0"
            >
              {refineMutation.isPending ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Send className="h-5 w-5" />
              )}
          </Button>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Press Enter or ⌘↵ to send, Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  );
}

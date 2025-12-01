import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const SUPABASE_URL = "https://etrxjxstjfcozdjumfsj.supabase.co";

export function useChatWithGio() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isReadyForCreation, setIsReadyForCreation] = useState(false);
  const { toast } = useToast();

  const sendMessage = async (userMessage: string) => {
    if (!userMessage.trim()) return;

    // Add user message to UI immediately
    const newUserMessage: Message = { role: 'user', content: userMessage };
    setMessages(prev => [...prev, newUserMessage]);
    setIsLoading(true);

    try {
      // Get session for auth
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('Not authenticated');
      }

      // Add empty assistant message that will be filled progressively
      setMessages(prev => [...prev, { role: 'assistant', content: '' }]);
      setIsStreaming(true);

      const response = await fetch(`${SUPABASE_URL}/functions/v1/chat-with-gio`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ 
          userMessage,
          conversationId 
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `HTTP error ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('No response body');
      }

      const decoder = new TextDecoder();
      let buffer = '';
      let receivedDone = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine || !trimmedLine.startsWith('data: ')) continue;

          try {
            const data = JSON.parse(trimmedLine.slice(6));

            if (data.delta) {
              // Update the last message (assistant) with new content
              setMessages(prev => {
                const updated = [...prev];
                const lastMessage = updated[updated.length - 1];
                if (lastMessage && lastMessage.role === 'assistant') {
                  updated[updated.length - 1] = {
                    ...lastMessage,
                    content: lastMessage.content + data.delta
                  };
                }
                return updated;
              });
            }

            if (data.done) {
              receivedDone = true;
              setConversationId(data.conversationId);
              setIsReadyForCreation(data.isReadyForCreation);
            }

            if (data.error) {
              throw new Error(data.error);
            }
          } catch (parseError) {
            // Skip malformed JSON lines
            console.warn('Failed to parse SSE line:', trimmedLine);
          }
        }
      }

      // Process any remaining buffer
      if (buffer.trim() && buffer.trim().startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.trim().slice(6));
          if (data.delta) {
            setMessages(prev => {
              const updated = [...prev];
              const lastMessage = updated[updated.length - 1];
              if (lastMessage && lastMessage.role === 'assistant') {
                updated[updated.length - 1] = {
                  ...lastMessage,
                  content: lastMessage.content + data.delta
                };
              }
              return updated;
            });
          }
          if (data.done && !receivedDone) {
            setConversationId(data.conversationId);
            setIsReadyForCreation(data.isReadyForCreation);
          }
        } catch (e) {
          // Skip
        }
      }

      // Clean up the JSON metadata from displayed message
      setMessages(prev => {
        const updated = [...prev];
        const lastMessage = updated[updated.length - 1];
        if (lastMessage && lastMessage.role === 'assistant') {
          // Remove the JSON metadata block from the displayed message
          const cleanContent = lastMessage.content
            .replace(/\{[^}]*"ready_for_creation":\s*(true|false)[^}]*\}/g, '')
            .trim();
          updated[updated.length - 1] = {
            ...lastMessage,
            content: cleanContent
          };
        }
        return updated;
      });

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send message. Please try again.',
        variant: 'destructive'
      });
      
      // Remove the optimistic messages on error
      setMessages(prev => prev.slice(0, -2));
    } finally {
      setIsLoading(false);
      setIsStreaming(false);
    }
  };

  const resetConversation = () => {
    setMessages([]);
    setConversationId(null);
    setIsReadyForCreation(false);
  };

  const restoreMessages = (restoredMessages: Message[]) => {
    setMessages(restoredMessages);
  };

  return {
    messages,
    isLoading,
    isStreaming,
    conversationId,
    isReadyForCreation,
    sendMessage,
    resetConversation,
    restoreMessages
  };
}

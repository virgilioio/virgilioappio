import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useToast } from '@/hooks/use-toast';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export function useChatWithGio() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
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
      const { data, error } = await supabase.functions.invoke('chat-with-gio', {
        body: { 
          userMessage,
          conversationId 
        }
      });

      if (error) throw error;

      // Add assistant message to UI
      const assistantMessage: Message = { 
        role: 'assistant', 
        content: data.message 
      };
      setMessages(prev => [...prev, assistantMessage]);
      
      // Update conversation state
      setConversationId(data.conversationId);
      setIsReadyForCreation(data.isReadyForCreation);

    } catch (error) {
      console.error('Error sending message:', error);
      toast({
        title: 'Error',
        description: 'Failed to send message. Please try again.',
        variant: 'destructive'
      });
      
      // Remove the optimistic user message on error
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsLoading(false);
    }
  };

  const resetConversation = () => {
    setMessages([]);
    setConversationId(null);
    setIsReadyForCreation(false);
  };

  const restoreMessages = (restoredMessages: Message[]) => {
    setMessages(restoredMessages);
    // Don't restore conversationId as it might be stale
    // Let the next message create a new conversation
  };

  return {
    messages,
    isLoading,
    conversationId,
    isReadyForCreation,
    sendMessage,
    resetConversation,
    restoreMessages
  };
}

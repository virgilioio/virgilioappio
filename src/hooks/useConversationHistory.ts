import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

interface ConversationMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: any;
  created_at: string;
}

interface Conversation {
  id: string;
  sourcing_project_id: string;
  tenant_id: string;
  created_by: string;
  initial_prompt: string;
  created_at: string;
  updated_at: string;
}

export function useConversationHistory(projectId: string) {
  return useQuery({
    queryKey: ['conversation-history', projectId],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke('fetch-conversation', {
        body: { sourcing_project_id: projectId }
      });

      if (error) throw error;

      return {
        conversation: data.conversation as Conversation | null,
        messages: (data.messages || []) as ConversationMessage[]
      };
    },
    enabled: !!projectId,
    staleTime: 30000 // 30 seconds
  });
}

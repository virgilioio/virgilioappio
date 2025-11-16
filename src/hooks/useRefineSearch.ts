import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { toast } from 'sonner';

interface RefineSearchParams {
  projectId: string;
  userMessage: string;
  conversationHistory: Array<{ role: string; content: string }>;
}

export function useRefineSearch() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ projectId, userMessage, conversationHistory }: RefineSearchParams) => {
      const { data, error } = await supabase.functions.invoke('refine-sourcing-project', {
        body: {
          project_id: projectId,
          user_message: userMessage,
          conversation_history: conversationHistory
        }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (_, variables) => {
      toast.success('Search criteria updated');
      
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['sourcing-project', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['sourcing-project-candidates', variables.projectId] });
      queryClient.invalidateQueries({ queryKey: ['conversation-history', variables.projectId] });
    },
    onError: (error) => {
      console.error('Failed to refine search:', error);
      toast.error('Failed to refine search', {
        description: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  });
}

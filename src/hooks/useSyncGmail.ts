import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export function useSyncGmail() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (mailIdentityId: string) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('sync-gmail-messages', {
        body: { mail_identity_id: mailIdentityId },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Synced ${data.synced} new emails`);
      queryClient.invalidateQueries({ queryKey: ['email-logs'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to sync emails: ${error.message}`);
    },
  });
}

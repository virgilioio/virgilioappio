import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOrgContext } from '@/contexts/OrgContext';

export interface MailIdentity {
  id: string;
  user_id: string;
  organization_id: string;
  provider: string;
  email_address: string;
  display_name: string;
  is_active: boolean;
  sync_status: string;
  last_sync_at: string;
  created_at: string;
  token_expires_at: string;
}

export function useMailIdentities() {
  const queryClient = useQueryClient();

  const { data: identities, isLoading } = useQuery({
    queryKey: ['mail-identities'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('user_mail_identities')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MailIdentity[];
    },
  });

  const connectGmail = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('mail-oauth-start', {
        body: { provider: 'gmail' },
      });

      if (error) throw error;
      return data as { auth_url: string; code_verifier: string; state: string };
    },
    onSuccess: (data) => {
      const { auth_url, code_verifier, state } = data;

      // Save verifier keyed by state (localStorage is shared with popup)
      localStorage.setItem(`mail_oauth:${state}:code_verifier`, code_verifier);
      localStorage.setItem(`mail_oauth:${state}:provider`, 'gmail');

      // Open OAuth popup
      const popup = window.open(
        auth_url,
        'gmail-oauth',
        'width=520,height=640,scrollbars=yes'
      );

      if (!popup) {
        toast.error('Please allow popups for this site');
        return;
      }

      // Listen for success/error from the popup
      const onMessage = (e: MessageEvent) => {
        if (e.origin !== window.location.origin) return;
        
        if (e.data?.type === 'mail-oauth-success') {
          window.removeEventListener('message', onMessage);
          toast.success(`Connected ${e.data.payload.email}`);
          queryClient.invalidateQueries({ queryKey: ['mail-identities'] });
        }
        
        if (e.data?.type === 'mail-oauth-error') {
          window.removeEventListener('message', onMessage);
          toast.error(e.data.error || 'Failed to connect account');
        }
      };
      
      window.addEventListener('message', onMessage);
    },
    onError: (error: Error) => {
      toast.error(`Failed to connect Gmail: ${error.message}`);
    },
  });

  const handleOAuthCallback = useMutation({
    mutationFn: async (params: { code: string; state: string; code_verifier: string }) => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('mail-oauth-callback', {
        body: {
          code: params.code,
          state: params.state,
          code_verifier: params.code_verifier,
        },
      });

      if (error) throw error;
      return data;
    },
  });

  const disconnectIdentity = useMutation({
    mutationFn: async (identityId: string) => {
      const { error } = await supabase
        .from('user_mail_identities')
        .delete()
        .eq('id', identityId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Email account disconnected');
      queryClient.invalidateQueries({ queryKey: ['mail-identities'] });
    },
    onError: (error: Error) => {
      toast.error(`Failed to disconnect: ${error.message}`);
    },
  });

  return {
    identities: identities || [],
    isLoading,
    connectGmail,
    disconnectIdentity,
    handleOAuthCallback,
  };
}

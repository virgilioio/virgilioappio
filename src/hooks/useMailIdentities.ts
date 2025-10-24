import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
      const { data, error } = await supabase
        .from('user_mail_identities')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as MailIdentity[];
    },
  });

  const connectGmail = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('mail-oauth-start', {
        body: { provider: 'gmail' },
      });

      if (error) throw error;
      return data as { auth_url: string; code_verifier: string; state: string };
    },
    onSuccess: (data) => {
      // Store code_verifier temporarily for callback
      sessionStorage.setItem('oauth_code_verifier', data.code_verifier);
      sessionStorage.setItem('oauth_state', data.state);
      
      // Open OAuth popup
      const width = 600;
      const height = 700;
      const left = window.screen.width / 2 - width / 2;
      const top = window.screen.height / 2 - height / 2;
      
      const popup = window.open(
        data.auth_url,
        'Gmail OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      );

      // Poll for OAuth callback
      const pollTimer = setInterval(() => {
        try {
          if (popup?.closed) {
            clearInterval(pollTimer);
            // Check if callback was successful
            const success = sessionStorage.getItem('oauth_success');
            if (success === 'true') {
              toast.success('Gmail account connected successfully');
              queryClient.invalidateQueries({ queryKey: ['mail-identities'] });
              sessionStorage.removeItem('oauth_success');
              sessionStorage.removeItem('oauth_code_verifier');
              sessionStorage.removeItem('oauth_state');
            }
          }
        } catch (e) {
          // Cross-origin errors are expected
        }
      }, 500);
    },
    onError: (error: Error) => {
      toast.error(`Failed to connect Gmail: ${error.message}`);
    },
  });

  const handleOAuthCallback = useMutation({
    mutationFn: async (params: { code: string; state: string }) => {
      const codeVerifier = sessionStorage.getItem('oauth_code_verifier');
      const storedState = sessionStorage.getItem('oauth_state');

      if (!codeVerifier || params.state !== storedState) {
        throw new Error('Invalid OAuth state');
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('mail-oauth-callback', {
        body: {
          code: params.code,
          state: params.state,
          code_verifier: codeVerifier,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      sessionStorage.setItem('oauth_success', 'true');
      queryClient.invalidateQueries({ queryKey: ['mail-identities'] });
    },
    onError: (error: Error) => {
      toast.error(`OAuth callback failed: ${error.message}`);
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

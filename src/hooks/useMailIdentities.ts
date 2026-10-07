import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useOrgContext } from '@/contexts/OrgContext';
import { useAuth } from '@/contexts/AuthContext';
import { useTenant } from '@/hooks/useTenant';
import { refreshOnboardingProgress } from '@/utils/refreshOnboardingProgress';

export interface MailIdentity {
  id: string;
  user_id: string;
  tenant_id: string;
  provider: string;
  email_address: string;
  display_name: string;
  is_active: boolean;
  sync_status: string;
  sync_error: string | null;
  last_sync_at: string;
  created_at: string;
  token_expires_at: string;
}

export function useMailIdentities() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { organizationId } = useOrgContext();
  const { tenant } = useTenant();

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

  // Single shared Google Workspace flow (Gmail + Calendar).
  const connectGmail = useMutation({
    mutationFn: () => startGoogleWorkspaceConnect(queryClient),
    onError: (error: Error) => {
      toast.error(`Failed to connect Google Workspace: ${error.message}`);
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
      queryClient.invalidateQueries({ queryKey: ['calendar-identities'] });
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

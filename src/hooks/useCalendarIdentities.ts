import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cacheTiers } from '@/lib/cache/cacheTiers';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { startGoogleWorkspaceConnect } from '@/lib/googleWorkspaceConnect';

export interface CalendarIdentity {
  id: string;
  user_id: string;
  tenant_id: string;
  provider: 'google' | 'microsoft';
  email_address: string;
  display_name: string | null;
  is_active: boolean;
  last_sync_at: string | null;
  sync_status: 'healthy' | 'error' | 'expired';
  sync_error_message: string | null;
  token_expires_at: string;
  created_at: string;
  updated_at: string;
}

export function useCalendarIdentities() {
  const queryClient = useQueryClient();

  const { data: identities, isLoading, error } = useQuery({
    queryKey: ['calendar-identities'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];

      const { data, error } = await supabase
        .from('calendar_identities')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CalendarIdentity[];
    },
    ...cacheTiers.reference,
  });

  const disconnectMutation = useMutation({
    mutationFn: async (identityId: string) => {
      const { error } = await supabase
        .from('calendar_identities')
        .delete()
        .eq('id', identityId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['calendar-identities'] });
      queryClient.invalidateQueries({ queryKey: ['mail-identities'] });
      toast.success('Calendar disconnected successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to disconnect calendar: ${error.message}`);
    },
  });

  const testConnectionMutation = useMutation({
    mutationFn: async (userId: string) => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      const { data, error } = await supabase.functions.invoke('check-calendar-availability', {
        body: {
          user_id: userId,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        },
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      console.log('[Calendar Test] Response data:', data);
      queryClient.invalidateQueries({ queryKey: ['calendar-identities'] });
      
      if (!data) {
        toast.error('No response from calendar service');
        return;
      }

      if (data.warning) {
        toast.warning(data.warning);
      } else if (data.error) {
        toast.error(data.error);
      } else if (data.busy_slots !== undefined) {
        toast.success(`Connection successful! Found ${data.busy_slots?.length || 0} events in the next 7 days.`);
      } else {
        toast.success('Connection test completed successfully');
      }
    },
    onError: (error: Error) => {
      toast.error(`Connection test failed: ${error.message}`);
    },
  });

  const connectGoogleCalendar = async () => {
    try {
      await startGoogleWorkspaceConnect(queryClient);
    } catch (error: any) {
      toast.error(`Failed to connect Google Workspace: ${error.message}`);
    }
  };

  return {
    identities: identities || [],
    isLoading,
    error,
    connectGoogleCalendar,
    disconnectCalendar: disconnectMutation.mutateAsync,
    isDisconnecting: disconnectMutation.isPending,
    testConnection: testConnectionMutation.mutate,
    isTesting: testConnectionMutation.isPending,
  };
}

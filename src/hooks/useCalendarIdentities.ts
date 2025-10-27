import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface CalendarIdentity {
  id: string;
  user_id: string;
  organization_id: string;
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
      const { data, error } = await supabase
        .from('calendar_identities')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as CalendarIdentity[];
    },
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
      queryClient.invalidateQueries({ queryKey: ['calendar-identities'] });
      
      if (data.warning) {
        toast.warning(data.warning);
      } else if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(`Connection successful! Found ${data.busy_slots?.length || 0} events in the next 7 days.`);
      }
    },
    onError: (error: Error) => {
      toast.error(`Connection test failed: ${error.message}`);
    },
  });

  const connectGoogleCalendar = () => {
    const supabaseUrl = "https://etrxjxstjfcozdjumfsj.supabase.co";
    window.location.href = `${supabaseUrl}/functions/v1/mail-oauth-start`;
  };

  return {
    identities: identities || [],
    isLoading,
    error,
    connectGoogleCalendar,
    disconnectCalendar: disconnectMutation.mutate,
    isDisconnecting: disconnectMutation.isPending,
    testConnection: testConnectionMutation.mutate,
    isTesting: testConnectionMutation.isPending,
  };
}

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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
      const { data, error } = await supabase.functions.invoke('mail-oauth-start', {
        body: { provider: 'gmail' }
      });

      if (error) throw error;

      // Store PKCE values for the callback
      localStorage.setItem(`mail_oauth:${data.state}:code_verifier`, data.code_verifier);
      localStorage.setItem(`mail_oauth:${data.state}:provider`, 'gmail');

      // Open OAuth in popup window
      const popup = window.open(
        data.auth_url,
        'google-calendar-oauth',
        'width=520,height=640,scrollbars=yes'
      );

      if (!popup) {
        toast.error('Please allow popups for this site');
        return;
      }

      // Listen for success/error from the popup
      const onMessage = async (e: MessageEvent) => {
        if (e.origin !== window.location.origin) return;
        
        if (e.data?.type === 'mail-oauth-success') {
          window.removeEventListener('message', onMessage);
          toast.success(`Calendar connected: ${e.data.payload.email}`);
          queryClient.invalidateQueries({ queryKey: ['calendar-identities'] });

          // Setup webhook for bidirectional sync
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            try {
              // Fetch the newly created calendar identity
              const { data: calendarIdentity } = await supabase
                .from('calendar_identities')
                .select('id')
                .eq('user_id', user.id)
                .eq('email_address', e.data.payload.email)
                .single();

              if (calendarIdentity) {
                // Setup webhook for bidirectional calendar sync
                const { error: webhookError } = await supabase.functions.invoke('setup-calendar-watch', {
                  body: { calendar_identity_id: calendarIdentity.id }
                });

                if (webhookError) {
                  console.error('[Calendar] Webhook setup failed:', webhookError);
                  toast.warning('Calendar connected, but sync setup failed. Please reconnect if needed.');
                } else {
                  console.log('[Calendar] Webhook setup successful for bidirectional sync');
                }
              }

              // Check if booking config exists
              const { data: bookingConfig } = await supabase
                .from('booking_configurations')
                .select('id, is_active')
                .eq('user_id', user.id)
                .maybeSingle();

              if (!bookingConfig) {
                // Trigger lazy creation by invalidating the query
                queryClient.invalidateQueries({ queryKey: ['booking-config'] });
                toast.success('Calendar connected! Setting up your booking link...');
              } else if (!bookingConfig.is_active) {
                // Activate existing config
                await supabase
                  .from('booking_configurations')
                  .update({ is_active: true })
                  .eq('id', bookingConfig.id);

                toast.success('Your booking link is now active! Share it with candidates.');
              }
            } catch (setupError) {
              console.error('[Calendar] Post-connection setup error:', setupError);
            }
          }
        }
        
        if (e.data?.type === 'mail-oauth-error') {
          window.removeEventListener('message', onMessage);
          toast.error(e.data.error || 'Failed to connect calendar');
        }
      };
      
      window.addEventListener('message', onMessage);
    } catch (error: any) {
      toast.error(`Failed to start OAuth: ${error.message}`);
    }
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

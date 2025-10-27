import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export interface BookingConfig {
  id: string;
  user_id: string;
  organization_id: string;
  short_code: string;
  display_name: string;
  description: string | null;
  is_active: boolean;
  available_days: number[];
  start_time: string;
  end_time: string;
  timezone: string;
  duration_minutes: number;
  buffer_time_minutes: number;
  min_notice_hours: number;
  max_days_ahead: number;
  meeting_location: string | null;
  created_at: string;
  updated_at: string;
}

export function useBookingConfig() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: config, isLoading, error } = useQuery({
    queryKey: ['booking-config', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('booking_configurations')
        .select('*')
        .eq('user_id', user?.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') {
        throw error;
      }
      return data as BookingConfig | null;
    },
    enabled: !!user,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<BookingConfig>) => {
      const { data, error } = await supabase
        .from('booking_configurations')
        .update(updates)
        .eq('user_id', user?.id)
        .select()
        .single();
      
      if (error) throw error;
      return data as BookingConfig;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-config'] });
      toast.success('Booking preferences updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  const createMutation = useMutation({
    mutationFn: async (params: {
      first_name: string;
      last_name: string;
      organization_id: string;
      timezone?: string;
    }) => {
      const { data, error } = await supabase.functions.invoke('create-booking-config', {
        body: params
      });
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['booking-config'] });
      toast.success('Your booking link has been created!');
    },
    onError: (error: Error) => {
      toast.error(`Failed to create booking link: ${error.message}`);
    },
  });

  const bookingUrl = config 
    ? `${window.location.origin}/schedule/${config.short_code}` 
    : null;

  return {
    config,
    isLoading,
    error,
    updateConfig: updateMutation.mutate,
    isUpdating: updateMutation.isPending,
    createConfig: createMutation.mutate,
    isCreating: createMutation.isPending,
    bookingUrl,
  };
}

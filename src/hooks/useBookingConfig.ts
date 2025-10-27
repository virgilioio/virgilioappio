import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { useAuth } from '@/contexts/AuthContext';
import { useOrgContext } from '@/contexts/OrgContext';
import { useUserProfile } from './useUserProfile';
import { toast } from 'sonner';

export interface WeeklySchedule {
  monday: { enabled: boolean; start: string; end: string };
  tuesday: { enabled: boolean; start: string; end: string };
  wednesday: { enabled: boolean; start: string; end: string };
  thursday: { enabled: boolean; start: string; end: string };
  friday: { enabled: boolean; start: string; end: string };
  saturday: { enabled: boolean; start: string; end: string };
  sunday: { enabled: boolean; start: string; end: string };
}

export interface BookingConfig {
  id: string;
  user_id: string;
  organization_id: string;
  short_code: string;
  display_name: string;
  description: string | null;
  is_active: boolean;
  
  // NEW: Weekly schedule
  weekly_schedule: WeeklySchedule;
  
  // OLD: Keep for backward compatibility (deprecated)
  available_days?: number[];
  start_time?: string;
  end_time?: string;
  
  timezone: string;
  duration_minutes: number;
  buffer_time_minutes: number;
  min_notice_hours: number;
  max_days_ahead: number;
  meeting_location: string | null;
  created_at: string;
  updated_at: string;
}

// Helper to get default weekly schedule
export const getDefaultWeeklySchedule = (): WeeklySchedule => ({
  monday: { enabled: true, start: '09:00', end: '17:00' },
  tuesday: { enabled: true, start: '09:00', end: '17:00' },
  wednesday: { enabled: true, start: '09:00', end: '17:00' },
  thursday: { enabled: true, start: '09:00', end: '17:00' },
  friday: { enabled: true, start: '09:00', end: '17:00' },
  saturday: { enabled: false, start: '09:00', end: '17:00' },
  sunday: { enabled: false, start: '09:00', end: '17:00' },
});

// Preset schedules
export const SCHEDULE_PRESETS = {
  standardBusiness: {
    name: 'Standard Business Hours',
    description: 'Monday-Friday, 9am-5pm',
    schedule: getDefaultWeeklySchedule(),
  },
  morningPerson: {
    name: 'Morning Person',
    description: 'Monday-Friday, 7am-1pm',
    schedule: {
      ...getDefaultWeeklySchedule(),
      monday: { enabled: true, start: '07:00', end: '13:00' },
      tuesday: { enabled: true, start: '07:00', end: '13:00' },
      wednesday: { enabled: true, start: '07:00', end: '13:00' },
      thursday: { enabled: true, start: '07:00', end: '13:00' },
      friday: { enabled: true, start: '07:00', end: '13:00' },
    },
  },
  afternoonOnly: {
    name: 'Afternoon Only',
    description: 'Monday-Friday, 1pm-6pm',
    schedule: {
      ...getDefaultWeeklySchedule(),
      monday: { enabled: true, start: '13:00', end: '18:00' },
      tuesday: { enabled: true, start: '13:00', end: '18:00' },
      wednesday: { enabled: true, start: '13:00', end: '18:00' },
      thursday: { enabled: true, start: '13:00', end: '18:00' },
      friday: { enabled: true, start: '13:00', end: '18:00' },
    },
  },
  weekendsToo: {
    name: 'Weekends Too',
    description: 'Monday-Sunday, 9am-5pm',
    schedule: {
      monday: { enabled: true, start: '09:00', end: '17:00' },
      tuesday: { enabled: true, start: '09:00', end: '17:00' },
      wednesday: { enabled: true, start: '09:00', end: '17:00' },
      thursday: { enabled: true, start: '09:00', end: '17:00' },
      friday: { enabled: true, start: '09:00', end: '17:00' },
      saturday: { enabled: true, start: '09:00', end: '17:00' },
      sunday: { enabled: true, start: '09:00', end: '17:00' },
    },
  },
};

export function useBookingConfig() {
  const { user } = useAuth();
  const { organizationId } = useOrgContext();
  const { profile } = useUserProfile();
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
      return data ? (data as unknown as BookingConfig) : null;
    },
    enabled: !!user,
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<BookingConfig>) => {
      // If weekly_schedule is being updated, sync old fields for backward compatibility
      if (updates.weekly_schedule) {
        const enabledDays: number[] = [];
        let earliestStart = '23:59';
        let latestEnd = '00:00';
        
        Object.entries(updates.weekly_schedule).forEach(([day, config]) => {
          if (config.enabled) {
            // Map day names to numbers (0=Sunday, 1=Monday, etc.)
            const dayMap: Record<string, number> = {
              sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
              thursday: 4, friday: 5, saturday: 6
            };
            enabledDays.push(dayMap[day]);
            
            if (config.start < earliestStart) earliestStart = config.start;
            if (config.end > latestEnd) latestEnd = config.end;
          }
        });
        
        updates.available_days = enabledDays;
        updates.start_time = earliestStart;
        updates.end_time = latestEnd;
      }
      
      const { data, error } = await supabase
        .from('booking_configurations')
        .update(updates as any)
        .eq('user_id', user?.id)
        .select()
        .single();
      
      if (error) throw error;
      return data as unknown as BookingConfig;
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

  // Auto-create booking config if profile is complete
  const needsProfileCompletion = !profile?.first_name || !profile?.last_name;
  const canCreateBookingConfig = !needsProfileCompletion && !!organizationId;

  // Lazy creation effect
  useQuery({
    queryKey: ['booking-config-lazy-create', user?.id, canCreateBookingConfig],
    queryFn: async () => {
      if (!config && canCreateBookingConfig && profile && organizationId) {
        console.log('[BookingConfig] Auto-creating booking config for existing user');
        createMutation.mutate({
          first_name: profile.first_name!,
          last_name: profile.last_name!,
          organization_id: organizationId,
          timezone: profile.timezone || undefined,
        });
      }
      return null;
    },
    enabled: !config && canCreateBookingConfig && !createMutation.isPending,
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
    needsProfileCompletion,
    canCreateBookingConfig,
  };
}

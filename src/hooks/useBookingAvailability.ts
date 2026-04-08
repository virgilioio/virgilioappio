import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

interface AvailabilitySlot {
  start: string;
  end: string;
}

interface BusyEvent {
  start: string;
  end: string;
}

interface AvailabilityResponse {
  available_slots: AvailabilitySlot[];
  busy_events?: BusyEvent[];
  total_slots: number;
  date_range: {
    start: string;
    end: string;
  };
}

export interface EventTypeOverrides {
  weekly_schedule?: Record<string, { enabled: boolean; start: string; end: string }>;
  buffer_time_minutes?: number;
  min_notice_hours?: number;
  max_days_ahead?: number;
  timezone?: string;
}

export function useBookingAvailability(
  bookingConfigId: string | undefined,
  startDate: Date,
  endDate: Date,
  durationMinutes: number,
  candidateTimezone: string,
  internalScheduling = false,
  eventTypeOverrides?: EventTypeOverrides
) {
  return useQuery({
    queryKey: ['booking-availability', bookingConfigId, startDate.toISOString(), endDate.toISOString(), durationMinutes, candidateTimezone, internalScheduling, eventTypeOverrides],
    queryFn: async () => {
      if (!bookingConfigId) throw new Error('Booking config ID is required');

      const { data, error } = await supabase.functions.invoke('get-booking-availability', {
        body: {
          booking_config_id: bookingConfigId,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          duration_minutes: durationMinutes,
          candidate_timezone: candidateTimezone,
          internal_scheduling: internalScheduling,
          ...(eventTypeOverrides && { event_type_overrides: eventTypeOverrides }),
        },
      });

      if (error) throw error;
      return data as AvailabilityResponse;
    },
    refetchInterval: 60000,
    staleTime: 30000,
    enabled: !!bookingConfigId,
  });
}

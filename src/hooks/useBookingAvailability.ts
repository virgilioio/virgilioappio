import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';

interface AvailabilitySlot {
  start: string;
  end: string;
}

interface AvailabilityResponse {
  available_slots: AvailabilitySlot[];
  total_slots: number;
  date_range: {
    start: string;
    end: string;
  };
}

export function useBookingAvailability(
  bookingConfigId: string | undefined,
  startDate: Date,
  endDate: Date,
  durationMinutes: number,
  candidateTimezone: string
) {
  return useQuery({
    queryKey: ['booking-availability', bookingConfigId, startDate.toISOString(), endDate.toISOString(), durationMinutes, candidateTimezone],
    queryFn: async () => {
      if (!bookingConfigId) throw new Error('Booking config ID is required');

      const { data, error } = await supabase.functions.invoke('get-booking-availability', {
        body: {
          booking_config_id: bookingConfigId,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          duration_minutes: durationMinutes,
          candidate_timezone: candidateTimezone,
        },
      });

      if (error) throw error;
      return data as AvailabilityResponse;
    },
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000, // Consider stale after 30 seconds
    enabled: !!bookingConfigId,
  });
}

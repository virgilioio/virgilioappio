import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface GetAvailabilityRequest {
  booking_config_id: string;
  start_date: string; // ISO 8601
  end_date: string;   // ISO 8601
  duration_minutes: number;
  candidate_timezone: string;
}

interface WeeklySchedule {
  [key: string]: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const {
      booking_config_id,
      start_date,
      end_date,
      duration_minutes,
      candidate_timezone,
    }: GetAvailabilityRequest = await req.json();

    console.log('[get-booking-availability] Request:', {
      booking_config_id,
      start_date,
      end_date,
      duration_minutes,
      candidate_timezone,
    });

    // Load booking configuration
    const { data: config, error: configError } = await supabase
      .from('booking_configurations')
      .select('*')
      .eq('id', booking_config_id)
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      return new Response(JSON.stringify({
        error: 'Booking configuration not found or inactive',
      }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate potential time slots
    const potentialSlots = generatePotentialSlots(
      new Date(start_date),
      new Date(end_date),
      config.weekly_schedule as WeeklySchedule,
      duration_minutes,
      config.buffer_time_minutes || 0,
      config.timezone
    );

    console.log('[get-booking-availability] Generated', potentialSlots.length, 'potential slots');

    // Apply booking rules
    const now = new Date();
    const minStartTime = new Date(now.getTime() + (config.min_notice_hours || 24) * 60 * 60 * 1000);
    const maxDate = new Date(now.getTime() + (config.max_days_ahead || 30) * 24 * 60 * 60 * 1000);

    let filteredSlots = potentialSlots.filter(slot => 
      slot.start >= minStartTime && slot.start <= maxDate
    );

    console.log('[get-booking-availability] After booking rules:', filteredSlots.length, 'slots');

    // Fetch Google Calendar busy times
    let googleBusySlots: Array<{ start: Date; end: Date }> = [];
    try {
      const { data: busyData, error: busyError } = await supabase.functions.invoke('check-calendar-availability', {
        body: {
          user_id: config.user_id,
          start_date: start_date,
          end_date: end_date,
          timezone: config.timezone,
        },
      });

      if (!busyError && busyData?.busy_slots) {
        googleBusySlots = busyData.busy_slots.map((slot: any) => ({
          start: new Date(slot.start),
          end: new Date(slot.end),
        }));
        console.log('[get-booking-availability] Google Calendar:', googleBusySlots.length, 'busy slots');
      }
    } catch (error) {
      console.warn('[get-booking-availability] Failed to fetch Google Calendar, continuing...', error);
    }

    // Fetch existing bookings
    const { data: existingBookings, error: bookingsError } = await supabase
      .from('scheduled_bookings')
      .select('scheduled_start, scheduled_end')
      .eq('booking_config_id', booking_config_id)
      .eq('status', 'confirmed')
      .gte('scheduled_start', start_date)
      .lte('scheduled_end', end_date);

    const bookedSlots = (existingBookings || []).map(booking => ({
      start: new Date(booking.scheduled_start),
      end: new Date(booking.scheduled_end),
    }));

    console.log('[get-booking-availability] Existing bookings:', bookedSlots.length);

    // Merge all busy times
    const allBusySlots = [...googleBusySlots, ...bookedSlots];

    // Filter out occupied slots
    const availableSlots = filteredSlots.filter(slot => {
      return !allBusySlots.some(busy => 
        // Check if slot overlaps with busy time
        slot.start < busy.end && slot.end > busy.start
      );
    });

    console.log('[get-booking-availability] Final available slots:', availableSlots.length);

    // Return slots in ISO format
    const formattedSlots = availableSlots.map(slot => ({
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
    }));

    return new Response(JSON.stringify({
      available_slots: formattedSlots,
      total_slots: formattedSlots.length,
      date_range: { start: start_date, end: end_date },
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('[get-booking-availability] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// Helper: Convert local timezone time to UTC
function createDateInTimezone(dateStr: string, timeStr: string, tz: string): Date {
  const combined = `${dateStr}T${timeStr}:00`;
  const utc = new Date(combined + 'Z');
  const tzStr = utc.toLocaleString('en-US', { timeZone: tz, hour12: false });
  const tzDate = new Date(tzStr);
  const offset = utc.getTime() - tzDate.getTime();
  return new Date(new Date(combined).getTime() - offset);
}

// Helper: Generate potential slots
function generatePotentialSlots(
  startDate: Date,
  endDate: Date,
  weeklySchedule: WeeklySchedule,
  durationMinutes: number,
  bufferMinutes: number,
  timezone: string
): Array<{ start: Date; end: Date }> {
  const slots: Array<{ start: Date; end: Date }> = [];
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayName = dayNames[currentDate.getDay()];
    const dayConfig = weeklySchedule[dayName];

    if (dayConfig && dayConfig.enabled) {
      // Create date string for timezone conversion
      const dateStr = currentDate.toISOString().split('T')[0]; // "YYYY-MM-DD"
      
      // Convert local timezone times to UTC
      const slotStart = createDateInTimezone(dateStr, dayConfig.start, timezone);
      const dayEnd = createDateInTimezone(dateStr, dayConfig.end, timezone);
      
      let currentSlot = new Date(slotStart);

      while (currentSlot.getTime() + durationMinutes * 60 * 1000 <= dayEnd.getTime()) {
        const slotEnd = new Date(currentSlot.getTime() + durationMinutes * 60 * 1000);
        slots.push({ start: new Date(currentSlot), end: slotEnd });
        
        // Move to next slot (duration + buffer)
        currentSlot = new Date(currentSlot.getTime() + (durationMinutes + bufferMinutes) * 60 * 1000);
      }
    }

    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return slots;
}

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WeeklySchedule {
  [key: string]: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

interface EventTypeOverrides {
  weekly_schedule?: WeeklySchedule;
  buffer_time_minutes?: number;
  min_notice_hours?: number;
  max_days_ahead?: number;
  timezone?: string;
}

interface GetAvailabilityRequest {
  booking_config_id: string;
  start_date: string;
  end_date: string;
  duration_minutes: number;
  candidate_timezone: string;
  internal_scheduling?: boolean;
  event_type_overrides?: EventTypeOverrides;
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
      internal_scheduling = false,
      event_type_overrides,
    }: GetAvailabilityRequest = await req.json();

    console.log('[get-booking-availability] Request:', {
      booking_config_id, start_date, end_date, duration_minutes,
      candidate_timezone, internal_scheduling,
      has_overrides: !!event_type_overrides,
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

    // Resolve effective settings: event type overrides take priority over parent config
    const effectiveTimezone = event_type_overrides?.timezone || config.timezone;
    const effectiveSchedule = (event_type_overrides?.weekly_schedule || config.weekly_schedule) as WeeklySchedule;
    const effectiveBuffer = event_type_overrides?.buffer_time_minutes ?? config.buffer_time_minutes ?? 0;
    const effectiveMinNotice = event_type_overrides?.min_notice_hours ?? config.min_notice_hours ?? 24;
    const effectiveMaxDays = event_type_overrides?.max_days_ahead ?? config.max_days_ahead ?? 30;

    // Generate potential time slots
    const potentialSlots = internal_scheduling
      ? generateUnrestrictedSlots(new Date(start_date), new Date(end_date), duration_minutes, effectiveTimezone)
      : generatePotentialSlots(new Date(start_date), new Date(end_date), effectiveSchedule, duration_minutes, effectiveBuffer, effectiveTimezone);

    console.log('[get-booking-availability] Generated', potentialSlots.length, 'potential slots');

    // Apply booking rules (skip if internal scheduling)
    let filteredSlots = potentialSlots;
    if (!internal_scheduling) {
      const now = new Date();
      const minStartTime = new Date(now.getTime() + effectiveMinNotice * 60 * 60 * 1000);
      const maxDate = new Date(now.getTime() + effectiveMaxDays * 24 * 60 * 60 * 1000);
      filteredSlots = potentialSlots.filter(slot => slot.start >= minStartTime && slot.start <= maxDate);
    }

    console.log('[get-booking-availability] After booking rules:', filteredSlots.length, 'slots');

    // Fetch Google Calendar busy times
    let googleBusySlots: Array<{ start: Date; end: Date }> = [];
    try {
      const calendarResponse = await fetch(`${supabaseUrl}/functions/v1/check-calendar-availability`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: config.user_id,
          start_date, end_date,
          timezone: effectiveTimezone,
        }),
      });

      if (calendarResponse.ok) {
        const busyData = await calendarResponse.json();
        if (busyData?.busy_slots) {
          googleBusySlots = busyData.busy_slots.map((slot: any) => ({
            start: new Date(slot.start),
            end: new Date(slot.end),
          }));
          console.log('[get-booking-availability] Google Calendar:', googleBusySlots.length, 'busy slots');
        }
      } else {
        const errorText = await calendarResponse.text();
        console.warn('[get-booking-availability] Calendar availability error:', calendarResponse.status, errorText);
      }
    } catch (error) {
      console.warn('[get-booking-availability] Failed to fetch Google Calendar, continuing...', error);
    }

    // Fetch existing bookings
    const { data: existingBookings } = await supabase
      .from('scheduled_bookings')
      .select('scheduled_start, scheduled_end')
      .eq('booking_config_id', booking_config_id)
      .eq('status', 'confirmed')
      .gte('scheduled_start', start_date)
      .lte('scheduled_end', end_date);

    const bookedSlots = (existingBookings || []).map(b => ({
      start: new Date(b.scheduled_start),
      end: new Date(b.scheduled_end),
    }));

    console.log('[get-booking-availability] Existing bookings:', bookedSlots.length);

    const filterBusySlots = internal_scheduling ? bookedSlots : [...googleBusySlots, ...bookedSlots];

    const availableSlots = filteredSlots.filter(slot =>
      !filterBusySlots.some(busy => slot.start < busy.end && slot.end > busy.start)
    );

    console.log('[get-booking-availability] Final available slots:', availableSlots.length);

    const formattedSlots = availableSlots.map(slot => ({
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
    }));

    const formattedBusyEvents = internal_scheduling
      ? googleBusySlots.map(slot => ({ start: slot.start.toISOString(), end: slot.end.toISOString() }))
      : undefined;

    return new Response(JSON.stringify({
      available_slots: formattedSlots,
      total_slots: formattedSlots.length,
      date_range: { start: start_date, end: end_date },
      ...(formattedBusyEvents && { busy_events: formattedBusyEvents }),
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

function createDateInTimezone(dateStr: string, timeStr: string, tz: string): Date {
  const localISO = `${dateStr}T${timeStr}:00`;
  const utcDate = new Date(localISO + 'Z');
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
  const parts = formatter.formatToParts(utcDate);
  const tzHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const tzMinute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');
  const [wantedHour, wantedMinute] = timeStr.split(':').map(Number);
  const diffMinutes = (wantedHour * 60 + wantedMinute) - (tzHour * 60 + tzMinute);
  return new Date(utcDate.getTime() + diffMinutes * 60 * 1000);
}

function generatePotentialSlots(
  startDate: Date, endDate: Date, weeklySchedule: WeeklySchedule,
  durationMinutes: number, bufferMinutes: number, timezone: string
): Array<{ start: Date; end: Date }> {
  const slots: Array<{ start: Date; end: Date }> = [];
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dayName = dayNames[currentDate.getDay()];
    const dayConfig = weeklySchedule[dayName];
    if (dayConfig && dayConfig.enabled) {
      const dateStr = currentDate.toISOString().split('T')[0];
      const slotStart = createDateInTimezone(dateStr, dayConfig.start, timezone);
      const dayEnd = createDateInTimezone(dateStr, dayConfig.end, timezone);
      let currentSlot = new Date(slotStart);
      while (currentSlot.getTime() + durationMinutes * 60 * 1000 <= dayEnd.getTime()) {
        const slotEnd = new Date(currentSlot.getTime() + durationMinutes * 60 * 1000);
        slots.push({ start: new Date(currentSlot), end: slotEnd });
        currentSlot = new Date(currentSlot.getTime() + (durationMinutes + bufferMinutes) * 60 * 1000);
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return slots;
}

function generateUnrestrictedSlots(
  startDate: Date, endDate: Date, durationMinutes: number, timezone: string
): Array<{ start: Date; end: Date }> {
  const slots: Array<{ start: Date; end: Date }> = [];
  let currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateStr = currentDate.toISOString().split('T')[0];
    for (let hour = 8; hour < 20; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
        const slotStart = createDateInTimezone(dateStr, timeStr, timezone);
        const slotEnd = new Date(slotStart.getTime() + durationMinutes * 60 * 1000);
        const dayEnd = createDateInTimezone(dateStr, '20:00', timezone);
        if (slotEnd <= dayEnd) {
          slots.push({ start: new Date(slotStart), end: slotEnd });
        }
      }
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return slots;
}

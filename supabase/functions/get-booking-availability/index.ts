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
  booking_config_id?: string;
  booking_config_ids?: string[];
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
      booking_config_ids,
      start_date,
      end_date,
      duration_minutes,
      candidate_timezone,
      internal_scheduling = false,
      event_type_overrides,
    }: GetAvailabilityRequest = await req.json();

    const isGroup = Array.isArray(booking_config_ids) && booking_config_ids.length > 1;

    // === GROUP MODE: intersect availability across multiple configs ===
    if (isGroup) {
      console.log('[get-booking-availability] GROUP mode for', booking_config_ids!.length, 'configs');

      const { data: configs, error: configsError } = await supabase
        .from('booking_configurations')
        .select('*')
        .in('id', booking_config_ids!)
        .eq('is_active', true);

      if (configsError || !configs || configs.length !== booking_config_ids!.length) {
        return new Response(JSON.stringify({
          error: 'One or more booking configurations not found or inactive',
        }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Effective windowing rules: max of min_notice, min of max_days
      const minNotices = configs.map(c => c.min_notice_hours ?? 24);
      const maxDays = configs.map(c => c.max_days_ahead ?? 30);
      const effectiveMinNotice = Math.max(...minNotices);
      const effectiveMaxDays = Math.min(...maxDays);

      // Build per-config potential slot sets and intersect
      let intersected: Array<{ start: Date; end: Date }> | null = null;

      for (const cfg of configs) {
        const tz = cfg.timezone;
        const sched = cfg.weekly_schedule as WeeklySchedule;
        const buf = cfg.buffer_time_minutes ?? 0;
        const slots = generatePotentialSlots(
          new Date(start_date), new Date(end_date), sched,
          duration_minutes, buf, tz
        );

        const keys = new Set(slots.map(s => `${s.start.toISOString()}|${s.end.toISOString()}`));

        if (intersected === null) {
          intersected = slots;
        } else {
          intersected = intersected.filter(s =>
            keys.has(`${s.start.toISOString()}|${s.end.toISOString()}`)
          );
        }
      }

      let filteredSlots = intersected || [];

      // Apply min_notice / max_days_ahead
      const now = new Date();
      const minStartTime = new Date(now.getTime() + effectiveMinNotice * 60 * 60 * 1000);
      const maxDate = new Date(now.getTime() + effectiveMaxDays * 24 * 60 * 60 * 1000);
      filteredSlots = filteredSlots.filter(s => s.start >= minStartTime && s.start <= maxDate);

      // Fetch each user's Google Calendar busy slots in parallel
      const busyResults = await Promise.all(configs.map(async (cfg) => {
        try {
          const r = await fetch(`${supabaseUrl}/functions/v1/check-calendar-availability`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: cfg.user_id,
              start_date, end_date,
              timezone: cfg.timezone,
            }),
          });
          if (!r.ok) return [];
          const j = await r.json();
          return (j?.busy_slots || []).map((s: any) => ({
            start: new Date(s.start), end: new Date(s.end),
          }));
        } catch {
          return [];
        }
      }));

      const allBusy = busyResults.flat();

      // Existing bookings on any of these configs
      const { data: existingBookings } = await supabase
        .from('scheduled_bookings')
        .select('scheduled_start, scheduled_end')
        .in('booking_config_id', booking_config_ids!)
        .eq('status', 'confirmed')
        .gte('scheduled_start', start_date)
        .lte('scheduled_end', end_date);

      const bookedSlots = (existingBookings || []).map(b => ({
        start: new Date(b.scheduled_start), end: new Date(b.scheduled_end),
      }));

      const blockers = [...allBusy, ...bookedSlots];

      const availableSlots = filteredSlots.filter(slot =>
        !blockers.some(b => slot.start < b.end && slot.end > b.start)
      );

      const formattedSlots = availableSlots.map(s => ({
        start: s.start.toISOString(), end: s.end.toISOString(),
      }));

      console.log('[get-booking-availability] GROUP final:', formattedSlots.length, 'slots');

      return new Response(JSON.stringify({
        available_slots: formattedSlots,
        total_slots: formattedSlots.length,
        date_range: { start: start_date, end: end_date },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // === SINGLE MODE (original behavior) ===
    if (!booking_config_id) {
      return new Response(JSON.stringify({ error: 'booking_config_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

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

// Returns minutes that the target tz is ahead of UTC at the given instant.
// e.g. America/Chicago in CDT => -300 (UTC is 300 min ahead-of-tz wall-clock means tz = UTC-5).
// Convention here: offsetMinutes such that wallClockUTC - trueUTC = offsetMinutes.
// So trueUTC = naiveUTCFromWallClock - offsetMinutes.
function getTimezoneOffsetMinutes(instant: Date, tz: string): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = formatter.formatToParts(instant);
  const get = (t: string) => parseInt(parts.find(p => p.type === t)?.value || '0');
  let hour = get('hour');
  if (hour === 24) hour = 0;
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  return (asUTC - instant.getTime()) / 60000;
}

function createDateInTimezone(dateStr: string, timeStr: string, tz: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const naiveUTC = Date.UTC(y, m - 1, d, hh, mm, 0);
  // First pass
  let offset = getTimezoneOffsetMinutes(new Date(naiveUTC), tz);
  let trueUTC = naiveUTC - offset * 60000;
  // Second pass to self-correct around DST transitions
  offset = getTimezoneOffsetMinutes(new Date(trueUTC), tz);
  trueUTC = naiveUTC - offset * 60000;
  return new Date(trueUTC);
}

function getDatePartsInTz(instant: Date, tz: string): { dateStr: string; weekday: string } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long',
  });
  const parts = formatter.formatToParts(instant);
  const get = (t: string) => parts.find(p => p.type === t)?.value || '';
  return {
    dateStr: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: get('weekday').toLowerCase(),
  };
}

function generatePotentialSlots(
  startDate: Date, endDate: Date, weeklySchedule: WeeklySchedule,
  durationMinutes: number, bufferMinutes: number, timezone: string
): Array<{ start: Date; end: Date }> {
  const slots: Array<{ start: Date; end: Date }> = [];
  let cursor = new Date(startDate);
  while (cursor <= endDate) {
    const { dateStr, weekday } = getDatePartsInTz(cursor, timezone);
    const dayConfig = weeklySchedule[weekday];
    if (dayConfig && dayConfig.enabled) {
      const slotStart = createDateInTimezone(dateStr, dayConfig.start, timezone);
      const dayEnd = createDateInTimezone(dateStr, dayConfig.end, timezone);
      let currentSlot = new Date(slotStart);
      while (currentSlot.getTime() + durationMinutes * 60 * 1000 <= dayEnd.getTime()) {
        const slotEnd = new Date(currentSlot.getTime() + durationMinutes * 60 * 1000);
        slots.push({ start: new Date(currentSlot), end: slotEnd });
        currentSlot = new Date(currentSlot.getTime() + (durationMinutes + bufferMinutes) * 60 * 1000);
      }
    }
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return slots;
}

function generateUnrestrictedSlots(
  startDate: Date, endDate: Date, durationMinutes: number, timezone: string
): Array<{ start: Date; end: Date }> {
  const slots: Array<{ start: Date; end: Date }> = [];
  let cursor = new Date(startDate);
  while (cursor <= endDate) {
    const { dateStr } = getDatePartsInTz(cursor, timezone);
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
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return slots;
}

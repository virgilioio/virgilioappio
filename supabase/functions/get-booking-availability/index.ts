import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WeeklySchedule {
  [key: string]: { enabled: boolean; start: string; end: string };
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

// =============================================================
// Timezone helpers (Intl-based, DST-safe)
// =============================================================

/**
 * Returns the offset in minutes that the given timezone is from UTC at the given instant.
 * Convention: offset such that wallClockAsIfUTC - trueUTC = offsetMinutes.
 * For America/Chicago in CDT (UTC-5), this returns -300.
 */
function getTzOffsetMinutes(instant: Date, tz: string): number {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(instant);
  const get = (t: string) => parseInt(parts.find(p => p.type === t)?.value || '0');
  let hour = get('hour');
  if (hour === 24) hour = 0;
  const asUTC = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  return (asUTC - instant.getTime()) / 60000;
}

/**
 * Convert a wall-clock (date + time) in the given timezone to a true UTC Date.
 * Two-pass to self-correct around DST transitions.
 */
function wallClockToUTC(dateStr: string, timeStr: string, tz: string): Date {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const naive = Date.UTC(y, m - 1, d, hh, mm, 0);
  let offset = getTzOffsetMinutes(new Date(naive), tz);
  let utc = naive - offset * 60000;
  offset = getTzOffsetMinutes(new Date(utc), tz);
  utc = naive - offset * 60000;
  return new Date(utc);
}

/**
 * Get YYYY-MM-DD and lowercase weekday name as observed in the given timezone.
 */
function getDatePartsInTz(instant: Date, tz: string): { dateStr: string; weekday: string } {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long',
  });
  const parts = fmt.formatToParts(instant);
  const get = (t: string) => parts.find(p => p.type === t)?.value || '';
  return {
    dateStr: `${get('year')}-${get('month')}-${get('day')}`,
    weekday: get('weekday').toLowerCase(),
  };
}

// =============================================================
// Timezone resolution
// =============================================================

/**
 * Resolves the effective host timezone using profile as the source of truth.
 * Override values are only honored when explicitly different from the profile tz.
 */
function resolveEffectiveTz(opts: {
  profileTz?: string | null;
  configTz?: string | null;
  eventTypeTz?: string | null;
}): string {
  const { profileTz, configTz, eventTypeTz } = opts;
  const profile = profileTz && profileTz.trim() ? profileTz : null;

  // Event type override only wins if explicitly different from profile
  if (eventTypeTz && eventTypeTz !== profile) return eventTypeTz;
  // Config override only wins if explicitly different from profile
  if (configTz && configTz !== profile) return configTz;
  if (profile) return profile;
  if (configTz) return configTz;
  if (eventTypeTz) return eventTypeTz;
  return 'UTC';
}

// =============================================================
// Slot generators
// =============================================================

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
      const slotStart = wallClockToUTC(dateStr, dayConfig.start, timezone);
      const dayEnd = wallClockToUTC(dateStr, dayConfig.end, timezone);
      let cur = new Date(slotStart);
      while (cur.getTime() + durationMinutes * 60000 <= dayEnd.getTime()) {
        const end = new Date(cur.getTime() + durationMinutes * 60000);
        slots.push({ start: new Date(cur), end });
        cur = new Date(cur.getTime() + (durationMinutes + bufferMinutes) * 60000);
      }
    }
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
  }
  return slots;
}

/**
 * Internal scheduling: generates the FULL 24h window per day, host-local.
 * No weekly schedule, no buffer, no min notice, no max days ahead.
 * Recruiters see everything, then we just subtract Google FreeBusy.
 */
function generateFull24hSlots(
  startDate: Date, endDate: Date, durationMinutes: number, timezone: string
): Array<{ start: Date; end: Date }> {
  const slots: Array<{ start: Date; end: Date }> = [];
  let cursor = new Date(startDate);
  while (cursor <= endDate) {
    const { dateStr } = getDatePartsInTz(cursor, timezone);
    const dayStart = wallClockToUTC(dateStr, '00:00', timezone);
    // Use the next-day 00:00 to handle DST cleanly (23 or 25 hour days).
    const nextCursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000);
    const { dateStr: nextDateStr } = getDatePartsInTz(nextCursor, timezone);
    const dayEnd = wallClockToUTC(nextDateStr, '00:00', timezone);
    let cur = new Date(dayStart);
    while (cur.getTime() + durationMinutes * 60000 <= dayEnd.getTime()) {
      slots.push({ start: new Date(cur), end: new Date(cur.getTime() + durationMinutes * 60000) });
      // Step every 15 minutes
      cur = new Date(cur.getTime() + 15 * 60000);
    }
    cursor = nextCursor;
  }
  return slots;
}

// =============================================================
// Profile timezone fetcher
// =============================================================

async function fetchProfileTz(supabase: any, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('timezone')
    .eq('user_id', userId)
    .maybeSingle();
  if (error || !data) return null;
  return data.timezone || null;
}

// =============================================================
// Main handler
// =============================================================

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

    // ============================================================
    // GROUP MODE
    // ============================================================
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

      // Resolve effective tz per host using profile as source of truth
      const profileTzs = await Promise.all(configs.map((c: any) => fetchProfileTz(supabase, c.user_id)));
      const effectiveTzs = configs.map((c: any, i: number) =>
        resolveEffectiveTz({ profileTz: profileTzs[i], configTz: c.timezone })
      );
      configs.forEach((c: any, i: number) => {
        console.log('[get-booking-availability] GROUP host', c.user_id, {
          profileTz: profileTzs[i], configTz: c.timezone, effectiveTz: effectiveTzs[i],
        });
      });

      const minNotices = configs.map((c: any) => c.min_notice_hours ?? 24);
      const maxDays = configs.map((c: any) => c.max_days_ahead ?? 30);
      const effectiveMinNotice = Math.max(...minNotices);
      const effectiveMaxDays = Math.min(...maxDays);

      let intersected: Array<{ start: Date; end: Date }> | null = null;

      for (let i = 0; i < configs.length; i++) {
        const cfg = configs[i];
        const tz = effectiveTzs[i];
        const slots = internal_scheduling
          ? generateFull24hSlots(new Date(start_date), new Date(end_date), duration_minutes, tz)
          : generatePotentialSlots(
              new Date(start_date), new Date(end_date),
              cfg.weekly_schedule as WeeklySchedule,
              duration_minutes, cfg.buffer_time_minutes ?? 0, tz
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

      if (!internal_scheduling) {
        const now = new Date();
        const minStartTime = new Date(now.getTime() + effectiveMinNotice * 60 * 60 * 1000);
        const maxDate = new Date(now.getTime() + effectiveMaxDays * 24 * 60 * 60 * 1000);
        filteredSlots = filteredSlots.filter(s => s.start >= minStartTime && s.start <= maxDate);
      }

      const busyResults = await Promise.all(configs.map(async (cfg: any, i: number) => {
        try {
          const r = await fetch(`${supabaseUrl}/functions/v1/check-calendar-availability`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              user_id: cfg.user_id, start_date, end_date, timezone: effectiveTzs[i],
            }),
          });
          if (!r.ok) return [];
          const j = await r.json();
          return (j?.busy_slots || []).map((s: any) => ({
            start: new Date(s.start), end: new Date(s.end),
          }));
        } catch { return []; }
      }));

      const allBusy = busyResults.flat();

      const { data: existingBookings } = await supabase
        .from('scheduled_bookings')
        .select('scheduled_start, scheduled_end')
        .in('booking_config_id', booking_config_ids!)
        .eq('status', 'confirmed')
        .gte('scheduled_start', start_date)
        .lte('scheduled_end', end_date);

      const bookedSlots = (existingBookings || []).map((b: any) => ({
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
        busy_events: allBusy.map(s => ({
          start: s.start.toISOString(),
          end: s.end.toISOString(),
        })),
        total_slots: formattedSlots.length,
        date_range: { start: start_date, end: end_date },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============================================================
    // SINGLE MODE
    // ============================================================
    if (!booking_config_id) {
      return new Response(JSON.stringify({ error: 'booking_config_id is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const { data: config, error: configError } = await supabase
      .from('booking_configurations')
      .select('*')
      .eq('id', booking_config_id)
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      return new Response(JSON.stringify({
        error: 'Booking configuration not found or inactive',
      }), { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Profile timezone is the source of truth
    const profileTz = await fetchProfileTz(supabase, config.user_id);
    const effectiveTimezone = resolveEffectiveTz({
      profileTz,
      configTz: config.timezone,
      eventTypeTz: event_type_overrides?.timezone,
    });

    console.log('[get-booking-availability] tz resolution:', {
      booking_config_id, internal_scheduling,
      profileTz, configTz: config.timezone,
      eventTypeTz: event_type_overrides?.timezone,
      effectiveTimezone,
    });

    // ============================================================
    // INTERNAL SCHEDULING BRANCH (full 24h, no rules)
    // ============================================================
    if (internal_scheduling) {
      const potentialSlots = generateFull24hSlots(
        new Date(start_date), new Date(end_date), duration_minutes, effectiveTimezone
      );
      console.log('[get-booking-availability] INTERNAL generated', potentialSlots.length, 'slots');

      let googleBusySlots: Array<{ start: Date; end: Date }> = [];
      try {
        const r = await fetch(`${supabaseUrl}/functions/v1/check-calendar-availability`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            user_id: config.user_id, start_date, end_date, timezone: effectiveTimezone,
          }),
        });
        if (r.ok) {
          const j = await r.json();
          if (j?.busy_slots) {
            googleBusySlots = j.busy_slots.map((s: any) => ({
              start: new Date(s.start), end: new Date(s.end),
            }));
          }
        }
      } catch (e) {
        console.warn('[get-booking-availability] FreeBusy fetch failed (internal):', e);
      }

      const { data: existingBookings } = await supabase
        .from('scheduled_bookings')
        .select('scheduled_start, scheduled_end')
        .eq('booking_config_id', booking_config_id)
        .eq('status', 'confirmed')
        .gte('scheduled_start', start_date)
        .lte('scheduled_end', end_date);

      const bookedSlots = (existingBookings || []).map((b: any) => ({
        start: new Date(b.scheduled_start), end: new Date(b.scheduled_end),
      }));

      // Internal flow: only filter out actual existing bookings, not FreeBusy
      // (recruiter still sees the busy events as informational).
      const availableSlots = potentialSlots.filter(slot =>
        !bookedSlots.some(b => slot.start < b.end && slot.end > b.start)
      );

      console.log('[get-booking-availability] INTERNAL final:', availableSlots.length, 'slots');

      return new Response(JSON.stringify({
        available_slots: availableSlots.map(s => ({
          start: s.start.toISOString(), end: s.end.toISOString(),
        })),
        busy_events: googleBusySlots.map(s => ({
          start: s.start.toISOString(), end: s.end.toISOString(),
        })),
        total_slots: availableSlots.length,
        date_range: { start: start_date, end: end_date },
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // ============================================================
    // PUBLIC BOOKING BRANCH
    // ============================================================
    const effectiveSchedule = (event_type_overrides?.weekly_schedule || config.weekly_schedule) as WeeklySchedule;
    const effectiveBuffer = event_type_overrides?.buffer_time_minutes ?? config.buffer_time_minutes ?? 0;
    const effectiveMinNotice = event_type_overrides?.min_notice_hours ?? config.min_notice_hours ?? 24;
    const effectiveMaxDays = event_type_overrides?.max_days_ahead ?? config.max_days_ahead ?? 30;

    const potentialSlots = generatePotentialSlots(
      new Date(start_date), new Date(end_date),
      effectiveSchedule, duration_minutes, effectiveBuffer, effectiveTimezone
    );
    console.log('[get-booking-availability] PUBLIC generated', potentialSlots.length, 'slots');

    const now = new Date();
    const minStartTime = new Date(now.getTime() + effectiveMinNotice * 60 * 60 * 1000);
    const maxDate = new Date(now.getTime() + effectiveMaxDays * 24 * 60 * 60 * 1000);
    let filteredSlots = potentialSlots.filter(s => s.start >= minStartTime && s.start <= maxDate);

    let googleBusySlots: Array<{ start: Date; end: Date }> = [];
    try {
      const r = await fetch(`${supabaseUrl}/functions/v1/check-calendar-availability`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: config.user_id, start_date, end_date, timezone: effectiveTimezone,
        }),
      });
      if (r.ok) {
        const j = await r.json();
        if (j?.busy_slots) {
          googleBusySlots = j.busy_slots.map((s: any) => ({
            start: new Date(s.start), end: new Date(s.end),
          }));
        }
      }
    } catch (e) {
      console.warn('[get-booking-availability] FreeBusy fetch failed (public):', e);
    }

    const { data: existingBookings } = await supabase
      .from('scheduled_bookings')
      .select('scheduled_start, scheduled_end')
      .eq('booking_config_id', booking_config_id)
      .eq('status', 'confirmed')
      .gte('scheduled_start', start_date)
      .lte('scheduled_end', end_date);

    const bookedSlots = (existingBookings || []).map((b: any) => ({
      start: new Date(b.scheduled_start), end: new Date(b.scheduled_end),
    }));

    const blockers = [...googleBusySlots, ...bookedSlots];
    const availableSlots = filteredSlots.filter(slot =>
      !blockers.some(b => slot.start < b.end && slot.end > b.start)
    );

    console.log('[get-booking-availability] PUBLIC final:', availableSlots.length, 'slots');

    return new Response(JSON.stringify({
      available_slots: availableSlots.map(s => ({
        start: s.start.toISOString(), end: s.end.toISOString(),
      })),
      total_slots: availableSlots.length,
      date_range: { start: start_date, end: end_date },
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (error: any) {
    console.error('[get-booking-availability] Error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

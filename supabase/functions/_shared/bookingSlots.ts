/**
 * Booking link times (shared by get-booking-availability and its tests).
 *
 * Start times (Allan, 2026-11-05): a booking link or event type can offer times on a
 * grid (`start_interval_minutes`: 15, 30 or 60, counted from midnight in the host's
 * time zone) instead of back to back from the start of the day. On a grid the buffer is
 * breathing room around what's already in the calendar or booked; back to back keeps the
 * old meaning, the gap between one offered time and the next.
 */

export interface WeeklySchedule {
  [key: string]: { enabled: boolean; start: string; end: string };
}

export const START_INTERVALS = [15, 30, 60] as const

/** A usable grid step, or null for back to back. */
export function startInterval(v: unknown): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  return (START_INTERVALS as readonly number[]).includes(n) ? n : null
}

// =============================================================
// Timezone helpers (Intl-based, DST-safe)
// =============================================================

/**
 * Returns the offset in minutes that the given timezone is from UTC at the given instant.
 * Convention: offset such that wallClockAsIfUTC - trueUTC = offsetMinutes.
 * For America/Chicago in CDT (UTC-5), this returns -300.
 */
export function getTzOffsetMinutes(instant: Date, tz: string): number {
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
export function wallClockToUTC(dateStr: string, timeStr: string, tz: string): Date {
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
export function getDatePartsInTz(instant: Date, tz: string): { dateStr: string; weekday: string } {
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

/** "HH:MM" as minutes after midnight. */
export function hhmmToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

export function minutesToHhmm(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`
}

/**
 * Times offered in the weekly schedule between two dates. Back to back (interval null):
 * from the start of each day, one after another with the buffer between them. On a grid:
 * every `interval` minutes from the first grid time at or after the day's start.
 */
export function generatePotentialSlots(
  startDate: Date, endDate: Date, weeklySchedule: WeeklySchedule,
  durationMinutes: number, bufferMinutes: number, timezone: string,
  interval: number | null = null,
): Array<{ start: Date; end: Date }> {
  const slots: Array<{ start: Date; end: Date }> = []
  let cursor = new Date(startDate)
  while (cursor <= endDate) {
    const { dateStr, weekday } = getDatePartsInTz(cursor, timezone)
    const dayConfig = weeklySchedule?.[weekday]
    if (dayConfig && dayConfig.enabled) {
      const dayEnd = wallClockToUTC(dateStr, dayConfig.end, timezone)
      if (interval) {
        const startMin = hhmmToMinutes(dayConfig.start)
        const endMin = hhmmToMinutes(dayConfig.end)
        for (let m = Math.ceil(startMin / interval) * interval; m + durationMinutes <= endMin; m += interval) {
          const start = wallClockToUTC(dateStr, minutesToHhmm(m), timezone)
          const end = new Date(start.getTime() + durationMinutes * 60000)
          if (end.getTime() <= dayEnd.getTime()) slots.push({ start, end })
        }
      } else {
        let cur = wallClockToUTC(dateStr, dayConfig.start, timezone)
        while (cur.getTime() + durationMinutes * 60000 <= dayEnd.getTime()) {
          const end = new Date(cur.getTime() + durationMinutes * 60000)
          slots.push({ start: new Date(cur), end })
          cur = new Date(cur.getTime() + (durationMinutes + bufferMinutes) * 60000)
        }
      }
    }
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  }
  return slots
}

/**
 * Drops the times that clash with something already in the calendar or booked. On a
 * grid the buffer keeps that much room before and after each of them.
 */
export function freeSlots<T extends { start: Date; end: Date }>(
  slots: T[], blockers: Array<{ start: Date; end: Date }>, bufferMinutes: number, onGrid: boolean,
): T[] {
  const pad = onGrid ? Math.max(0, bufferMinutes || 0) * 60000 : 0
  return slots.filter((slot) => !blockers.some((b) =>
    slot.start.getTime() < b.end.getTime() + pad && slot.end.getTime() > b.start.getTime() - pad,
  ))
}

/**
 * Booking start times (2026-11-05): when the offered times may start.
 * `start_interval_minutes` on a booking link and on each event type:
 *   15 | 30 | 60  on that grid from midnight in the host's time zone
 *   0 (or null on a link)  back to back from the start of the day, as before
 * On an event type null means "same as the booking link".
 * The server rule is `startInterval` in supabase/functions/_shared/bookingSlots.ts.
 */

export type StartInterval = 0 | 15 | 30 | 60

export const START_TIME_OPTIONS: { value: StartInterval; label: string; hint: string }[] = [
  { value: 30, label: 'On the hour and half hour', hint: '9:00, 9:30, 10:00' },
  { value: 60, label: 'On the hour only', hint: '9:00, 10:00, 11:00' },
  { value: 15, label: 'Every 15 minutes', hint: '9:00, 9:15, 9:30' },
  { value: 0, label: 'Back to back', hint: 'One after another' },
]

/** A link's stored value as the select shows it (null is back to back). */
export function linkStartTimes(v: number | null | undefined): StartInterval {
  return v === 15 || v === 30 || v === 60 ? v : 0
}

export const SAME_AS_LINK = 'link'

/** An event type's stored value as the select shows it (null is "same as the link"). */
export function eventStartTimes(v: number | null | undefined): StartInterval | typeof SAME_AS_LINK {
  return v === null || v === undefined ? SAME_AS_LINK : linkStartTimes(v)
}

export function startTimesLabel(v: number | null | undefined): string {
  return START_TIME_OPTIONS.find((o) => o.value === linkStartTimes(v))!.label
}

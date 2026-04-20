

## Bug: candidates can book WAY outside the configured times

### Root cause
`supabase/functions/create-booking/index.ts` accepts whatever `scheduled_start` / `scheduled_end` the client posts and **only checks that the slot doesn't overlap an existing booking**. There is **no server-side validation** that the requested time falls inside:

- the event type's (or config's) **weekly_schedule**
- the event type's **min_notice_hours** / **max_days_ahead** window
- the event type's **buffer_time_minutes** spacing
- the event type's **duration**

So any caller (including a stale browser tab, a re-used quick-link, a manually crafted POST, or a UI flow that loaded availability before an event type with a stricter schedule was picked) can write a booking far outside the host's configured hours. This matches what you saw.

A second contributing factor in `src/pages/PublicBookingPage.tsx`: when no `selectedEventType` is set yet, `useBookingAvailability` is called with `event_type_overrides: undefined`, so the **parent config's** wider schedule is used to generate slots. If the user later proceeds (e.g. via a quick-select or a contextual link path that bypasses the event picker), those wider slots can get booked even though the chosen event type has a much narrower schedule.

### Fix — server-side authoritative validation in `create-booking`

Add a single `validateRequestedSlot()` helper at the top of the request handler, run **before** the conflict check. It will:

1. Load `booking_configurations` (already loaded today) and, if `event_type_id` is provided in the body, load the matching row from `booking_event_types` and resolve the **effective** settings exactly the same way `get-booking-availability` does:
   - `effectiveTimezone = eventType.timezone ?? config.timezone`
   - `effectiveSchedule = eventType.weekly_schedule ?? config.weekly_schedule`
   - `effectiveBuffer = eventType.buffer_time_minutes ?? config.buffer_time_minutes ?? 0`
   - `effectiveMinNotice = eventType.min_notice_hours ?? config.min_notice_hours ?? 24`
   - `effectiveMaxDays = eventType.max_days_ahead ?? config.max_days_ahead ?? 30`
   - `effectiveDuration = eventType.duration_minutes ?? config.duration_minutes`

2. Validate `scheduled_start` / `scheduled_end` against those settings:
   - `(scheduled_end - scheduled_start)` must equal `effectiveDuration` (±1 min tolerance for ms drift)
   - `scheduled_start >= now + effectiveMinNotice`
   - `scheduled_start <= now + effectiveMaxDays`
   - The **day-of-week** (in `effectiveTimezone`) must be `enabled` in `effectiveSchedule`
   - The slot's **wall-clock start** in `effectiveTimezone` must be `>= dayConfig.start` AND its end `<= dayConfig.end`
   - The slot must align to the schedule's slot grid: `minutes_from_day_start % (effectiveDuration + effectiveBuffer) === 0` (so a 30-min event with a 15-min buffer can only start every 45 min from the day's start time)

3. If any check fails, return `400` with a clear error code (`SLOT_OUTSIDE_SCHEDULE` / `SLOT_TOO_SOON` / `SLOT_TOO_FAR` / `SLOT_DURATION_MISMATCH` / `SLOT_NOT_ALIGNED`) and a human-readable message. The UI already handles 4xx from this function.

4. **Bypass** these checks only when the request is an internal-scheduling create call (i.e. `booked_by_user_id` is set AND the caller is an authenticated workspace member — same intent as `internal_scheduling=true` in the availability function). This preserves the existing internal "overbooking" capability documented in the `internal-scheduling-flexibility` memory.

### Fix — client cleanup in `PublicBookingPage.tsx`

Two small changes to remove the second contributor:

- **Don't fetch availability until `selectedEventType` is resolved** when the config has any event types. Right now availability runs immediately on the parent config, which produces slots that can be wider than the chosen event allows.
- When a booking is created, also pass `event_type_id` (already passed) — confirm the create payload always carries it when an event type is selected. ✅ (already correct in code, just re-validate.)

### Out of scope for this fix
- Reschedule path (`reschedule_booking_id`): same `validateRequestedSlot()` will run for reschedules — no extra work.
- Backfill / cleanup of past invalid bookings: I can list them via a read-only query after deploy if you want, but won't auto-cancel.
- Admin/internal scheduling overrides — explicitly preserved.

### Files touched
1. `supabase/functions/create-booking/index.ts` — add `validateRequestedSlot()` and call it after config load, before the overlap check.
2. `src/pages/PublicBookingPage.tsx` — gate `useBookingAvailability` on `selectedEventType` being resolved when event types exist.

No DB changes. No new secrets.

### Test plan after deploy
1. Public link, single event type with `Mon–Fri 9–5`, `min_notice 24h` — try to POST a Sunday 6 AM slot via curl → expect `400 SLOT_OUTSIDE_SCHEDULE`.
2. Same link, post a slot 1h from now → expect `400 SLOT_TOO_SOON`.
3. Same link, post a slot 90 days out → expect `400 SLOT_TOO_FAR`.
4. Normal in-hours slot via the UI → succeeds.
5. Internal scheduling (recruiter manually books outside hours from the candidate sheet) → still succeeds.
6. Reschedule via candidate link to an out-of-hours slot → blocked.


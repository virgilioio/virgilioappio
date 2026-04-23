

## Simplify timezone + scheduling: profile tz wins, internal = full 24h

### The core idea

Two flows, two clean rule sets, one source of truth for timezone.

| Flow | Window | Rules applied | Calendar busy filter |
|---|---|---|---|
| **Internal (in-app scheduling)** | Full 24h host-local | None — recruiters see everything | Yes (Google FreeBusy) |
| **Public booking link** | Host's `weekly_schedule` | Buffer, min notice, max days ahead | Yes (Google FreeBusy) |

**Single source of truth for "host timezone":** `profiles.timezone`. Booking config and event type tz are only used when the user explicitly overrode them.

### File: `supabase/functions/get-booking-availability/index.ts`

Keep one function. Branch cleanly at the top.

1. **Resolve effective timezone once, per host:**
   ```
   effectiveTz =
     event_type_overrides?.timezone (only if explicitly different from profile)
     ?? booking_config.timezone (only if explicitly different from profile)
     ?? profile.timezone
     ?? 'UTC' (last resort)
   ```
   Add a join/fetch for `profiles.timezone` for each host. Log `{ profileTz, configTz, eventTypeTz, effectiveTz }` per host.

2. **Internal branch (`internal_scheduling: true`):**
   - Generate slots for **00:00–24:00 host-local** every day in the range, stepped by `duration_minutes`.
   - Skip `weekly_schedule`, `buffer_time_minutes`, `min_notice_hours`, `max_days_ahead` entirely.
   - Subtract Google FreeBusy busy events.
   - Return.

3. **Public branch (`internal_scheduling: false`):**
   - Use `weekly_schedule` from event type override → booking config (today's behavior, just cleaner).
   - Apply buffer, min notice, max days ahead.
   - Subtract FreeBusy.
   - Return.

4. **Replace the bug-prone `createDateInTimezone` helper.** Use a small, well-tested utility based on `Intl.DateTimeFormat({ timeZone, ...parts })` to:
   - Convert `(YYYY-MM-DD, HH:mm, tz) → UTC Date` correctly across DST.
   - Derive `YYYY-MM-DD` and weekday for a UTC instant **in the host's tz** (kills the day-slippage bug).
   Add Deno tests in `supabase/functions/get-booking-availability/availability_test.ts` covering: standard time, US DST forward, US DST backward, negative offsets (Chicago), positive offsets (Madrid), midnight-boundary day rollover.

5. **Group/AND mode** keeps working: each host resolves its own `effectiveTz`, generates its own slots, then intersect as today.

### File: `supabase/functions/create-booking-config/index.ts`

- Stop defaulting `timezone = 'UTC'`. Look up the user's `profiles.timezone` and use it. Fall back to the request body's `timezone`, then `UTC` only if nothing else exists.

### File: `src/components/settings/booking/EventTypeSheet.tsx`

- Stop hardcoding `'America/New_York'`. New event types inherit tz from the parent booking config (which now inherits from the profile). Pass parent booking config tz in via props.

### File: `src/components/settings/booking/EventTypesList.tsx` (or whichever opens the sheet)

- Pass the parent `booking_config.timezone` down to `EventTypeSheet` for the inheritance default.

### Database migration: backfill stale defaults

One targeted migration. **Only** updates rows that clearly look like leftover defaults — never touches values the user deliberately picked.

```sql
-- 1. Booking configs stuck on UTC: backfill from profile tz
update public.booking_configurations bc
set timezone = p.timezone
from public.profiles p
where bc.user_id = p.id
  and bc.timezone = 'UTC'
  and p.timezone is not null
  and p.timezone <> 'UTC';

-- 2. Event types stuck on America/New_York that don't match the parent config:
--    backfill from parent booking config tz
update public.booking_event_types et
set timezone = bc.timezone
from public.booking_configurations bc
where et.booking_config_id = bc.id
  and et.timezone = 'America/New_York'
  and bc.timezone is not null
  and bc.timezone <> 'America/New_York';
```

(I'll verify the exact column names with a `read_query` before issuing the migration.)

### Frontend: nothing else changes

`useBookingAvailability`, `AvailabilityCalendar`, `ScheduleInterviewSheet`, `PublicBookingPage` keep working as-is. Slots come back as ISO instants and render in the viewer's local time, which is already correct.

### Verification

1. Interviewer in `America/Chicago`, `weekly_schedule` 09:00–17:00:
   - **Internal flow** (Schedule Interview sheet) → shows full 24h Chicago-local minus busy events. No more 3 AM artifacts because there's no schedule math involved.
   - **Public flow** (booking link) → first slot at 9:00 AM Chicago, last at 17:00 minus duration.
2. Candidate in `Europe/Madrid` opens the public link → host's 9 AM Chicago shows as ~16:00 Madrid (DST-correct).
3. New booking config created → tz = profile tz, not `UTC`.
4. New event type created → tz = parent booking config tz, not `America/New_York`.
5. After backfill: existing affected rows now match the host's profile tz; rows with intentionally different tz are untouched.
6. Group/AND scheduling intersects correctly across hosts in different tz.
7. DST transition week: 9 AM stays 9 AM local both sides of the shift.
8. Deno tests pass for all timezone helper edge cases.

### Files touched

- `supabase/functions/get-booking-availability/index.ts` — resolve effectiveTz from profile, branch internal vs public, replace tz helper, add logs.
- `supabase/functions/get-booking-availability/availability_test.ts` — new Deno tests.
- `supabase/functions/create-booking-config/index.ts` — default tz from profile, not `UTC`.
- `src/components/settings/booking/EventTypeSheet.tsx` — inherit tz from parent booking config.
- `src/components/settings/booking/EventTypesList.tsx` (or equivalent parent) — pass parent tz prop.
- One migration for the targeted backfill.




## Fix booking availability starting at 3:00 AM (timezone bug)

### Root cause

In `supabase/functions/get-booking-availability/index.ts`, the helper `createDateInTimezone(dateStr, "09:00", "America/Chicago")` is broken:

1. It builds `2026-04-23T09:00:00Z` (treats the local time as UTC).
2. Formats that instant in Chicago → gets `04:00`.
3. Computes diff = `9*60 − 4*60 = +300 min` and **adds** it → ends up at `14:00 UTC` = **09:00 UTC**, which is **04:00 Chicago** (or 03:00 in DST).

That's exactly why every interviewer's availability begins at ~3:00 AM regardless of their configured "9:00 AM" start. The compounding bug:

- `dateStr = currentDate.toISOString().split('T')[0]` uses the UTC date when iterating days, so for users in negative offsets the day boundary slips by one near midnight.

Both `generatePotentialSlots` and `generateUnrestrictedSlots` call this helper, so the issue affects the candidate scheduling sheet **and** the public booking link, which matches the reported symptoms.

### Fix

**File:** `supabase/functions/get-booking-availability/index.ts`

1. **Rewrite `createDateInTimezone`** to compute the correct UTC instant for a wall-clock time in a given IANA timezone, using a robust two-pass offset approach:
   - Build a "naive UTC" Date from `${dateStr}T${timeStr}:00Z`.
   - Format it in the target tz to derive the tz's offset at that instant (handles DST).
   - Subtract that offset from the naive UTC to get the true UTC instant. Re-run once more to self-correct around DST transitions (standard trick).
   - Return the corrected `Date`.

2. **Fix the day iteration in `generatePotentialSlots` and `generateUnrestrictedSlots`** so `dateStr` is the calendar date **in the host's timezone**, not in UTC. Use an `Intl.DateTimeFormat` with `timeZone: timezone` and `year/month/day` parts to derive `YYYY-MM-DD`. Same change in both functions.

3. **Use the host tz (not UTC) when comparing `dayName`** as well — derive `weekday` from `Intl.DateTimeFormat` with the host tz, so Sunday/Monday boundaries match the schedule the host configured.

4. **No client changes.** `AvailabilityCalendar` and `useBookingAvailability` already serialize/deserialize ISO strings correctly; once slots come back at the right instants, they will render at the host's intended local times in the candidate's browser.

### Verification

1. Open a candidate profile → Schedule Interview → pick an interviewer in `America/Chicago` whose schedule is 9:00–17:00. Slots now start at **9:00 AM Chicago** (not 3:00 AM).
2. Open the public booking link as a candidate in a different tz (e.g., `Europe/Madrid`). Slots show the host's 9:00 AM Chicago shifted into Madrid time correctly (~16:00–17:00 CEST, depending on DST).
3. Group/AND mode (`booking_config_ids`) returns the same correct base slots before intersection.
4. Spot-check a DST transition week (e.g., March/November US DST boundary) — slots remain at 9:00 local on both sides of the transition.
5. Internal scheduling (unrestricted 8 AM–8 PM) starts at 8:00 host-local, not 2:00–3:00 AM.

### What does NOT change

- Frontend rendering, hooks, calendar component.
- DB schema, RLS, booking configs.
- `check-calendar-availability` and Google FreeBusy logic (already passes ISO instants correctly).

### Files touched

- `supabase/functions/get-booking-availability/index.ts` — rewrite `createDateInTimezone`, fix tz-aware day/weekday derivation in both slot generators.


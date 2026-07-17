# Fix past events disappearing on the Calendar page

## Current state
- `src/pages/Calendar.tsx` loads bookings via `useScheduledBookings('upcoming', permissions)`.
- The `useScheduledBookings` hook, when called with `status === 'upcoming'`, filters out any booking whose `scheduled_end` is earlier than the current time (`scheduled_end < now()`). It also restricts to statuses `confirmed` and `rescheduled`.
- This means an interview that already happened this morning, or a prior day of the current week, vanishes from the calendar grid as soon as its end time passes.
- The calendar itself already filters to the visible week on the client side (`weekEvents`), so the real-time date cutoff from the `upcoming` scope is the only thing removing past events.

## Proposed change
1. **Fetch all tenant bookings for the calendar**  
   Change `useScheduledBookings('upcoming', permissions)` in `Calendar.tsx` to `useScheduledBookings(undefined, permissions)`. This loads the full booking history instead of only future bookings.

2. **Preserve the cancelled-event exclusion**  
   Add a lightweight client-side filter in the `events` useMemo to drop bookings with `status === 'cancelled'`, so cancelled interviews do not clutter the calendar view. This keeps the existing behavior unchanged for every other status.

3. **Leave the visible-week and type/job/people filters untouched**  
   The `weekEvents` filter already limits events to the 5-day week, so the calendar will still show only the relevant slice of history. The event rendering, popovers, and "Needs scheduling" rail are not affected.

## Verification
- Refresh the Calendar page and confirm that past events still appear on the grid for the current week and when navigating to previous weeks.
- Confirm that cancelled events do not appear on the calendar.
- Confirm that future events still display normally and that type/job/people filters still work.

## Files touched
- `src/pages/Calendar.tsx` (one line + one small filter tweak)
- No backend, edge function, or database changes.

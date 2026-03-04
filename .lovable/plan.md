

# Fix Past Activities: Sort Order and Date Range

## Problems
1. **Sort order**: In `UpcomingActivities.tsx` line 80, activities are always sorted ascending (`a - b`), showing oldest first. For the Past tab, newest should be first.
2. **No date limit on past bookings**: The `useScheduledBookings` hook (line 173-176) fetches ALL past bookings with no date boundary, showing activities from months ago. The reminders hook already limits to the current month — bookings should match.

## Changes

### 1. `src/components/dashboard/UpcomingActivities.tsx`
- Pass `activeTab` into the `useMemo` deps and reverse the sort for the past tab:
  - Upcoming: ascending (soonest first) — keep `a - b`
  - Past: descending (most recent first) — use `b - a`

### 2. `src/hooks/useScheduledBookings.ts`
- In the `past` branch (line 173-176), add a filter to only fetch bookings from the current month:
  - Calculate `startOfMonth` as the 1st of the current month
  - Add `.gte('scheduled_start', startOfMonthIso)` to the past query so only current-month bookings are returned

This aligns bookings with the reminders hook which already filters to the current month.


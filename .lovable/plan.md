

# Auto-Select Today's Date in Manual Scheduling

## Problem

When the scheduling sheet opens, no date is selected. The two-column grid renders with only the TimeSlotsList card (showing "Select a date to view available times"), while the DayCalendarEvents card is conditionally hidden. This makes the TimeSlotsList card appear squeezed and off-center.

## Solution — Auto-select today

Initialize `selectedDate` to `new Date()` (today) instead of `null` in both scheduling sheets. This means:
- The calendar always highlights today on open
- Time slots load immediately for today
- The DayCalendarEvents sidebar is always visible
- No awkward half-width empty state

## Files changed

| File | Change |
|------|--------|
| `src/components/candidates/ScheduleInterviewSheet.tsx` | Change `selectedDate` initial state from `null` to `new Date()` |
| `src/components/candidates/SimpleScheduleInterviewSheet.tsx` | Same change |

Additionally, remove the `{selectedDate && ...}` conditional wrapper around DayCalendarEvents in both files — since a date is always selected, the wrapper is unnecessary. The component itself already handles the null case gracefully, but it will never be null now.

Two-line change per file. No other files affected.


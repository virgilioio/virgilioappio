

# Fix: Show "No Availability" Banner When No Slots Exist

## Problem

The "no availability" banner in the calendar only appears when `autoAdvanceCountRef.current >= 6`, a condition that's effectively never met because auto-advancing months is disabled. When there are no available time slots, the calendar just shows with all dates grayed out and no explanation — it looks broken.

## Solution

Simplify the condition: show the banner whenever availability has finished loading and there are zero available dates in the current month. Remove the `autoAdvanceCountRef` gate.

**In `PublicBookingPage.tsx` (line 614):**

Change:
```tsx
noAvailabilityInMonth={!isLoadingAvailability && availableDates.length === 0 && autoAdvanceCountRef.current >= 6}
```

To:
```tsx
noAvailabilityInMonth={!isLoadingAvailability && availableDates.length === 0}
```

## Files changed

| File | Change |
|------|--------|
| `src/pages/PublicBookingPage.tsx` | Remove `autoAdvanceCountRef >= 6` gate from `noAvailabilityInMonth` prop |




# Fix: Calendar starts at October instead of April

## Root cause

The auto-advance effect (line 182-186) fires in a chain reaction. It watches `currentMonth` in its dependency array, so each time it advances the month, the effect re-runs:

1. April loads → no availability → advance to May
2. May loads → no availability → advance to June
3. ... continues until it either finds slots or hits the 6-month cap (October)

The calendar jumps to October instantly because React batches these state updates and the availability query returns empty for each intermediate month.

## Fix

**File: `src/pages/PublicBookingPage.tsx`** (lines 169-187)

Remove `currentMonth` from the `useEffect` dependency array. Instead, only react to `availableDates` and `isLoadingAvailability` changes. The auto-advance should only trigger when a fresh availability response comes back empty — not when the month itself changes.

Additionally, the auto-advance should **not run on the initial month** (April/today). It should only kick in after the user has seen the current month is empty. This way:

- Calendar always opens on the current month (April)
- If April has no slots, show the "No available times this month" banner
- User can manually navigate, OR we auto-advance **once** after a brief delay to the next month with availability — but the starting view is always today's month

Concrete change:
- Remove `currentMonth` from the dependency array of the auto-advance effect
- Add a guard: only auto-advance if `autoAdvanceCountRef.current > 0` OR add a small initial flag that skips auto-advance on first render, letting the user see the current month first
- Alternatively (simpler): remove auto-advance entirely and rely on the "No available times this month" banner — the user clicks the arrow themselves. This is what Calendly does.

**Recommended approach**: Remove auto-advance entirely. Keep auto-select of first available date when dates exist. Show the banner when no dates are available. This matches Calendly behavior and eliminates the bug.

## Files changed

| File | Change |
|------|--------|
| `src/pages/PublicBookingPage.tsx` | Remove auto-advance logic from useEffect (lines 182-186), keep auto-select of first date, keep banner |


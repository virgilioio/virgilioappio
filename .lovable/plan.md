

# Smart Quick Schedule: Soonest + Golden Hours + Labels

## What changes

**File: `src/components/booking/QuickSchedulePanel.tsx`**

Replace the naive `slice(0, 5)` with smart slot selection logic:

### Selection algorithm

1. **Slot 1 — "Earliest available"**: Always the absolute first chronological slot, labeled with a badge.
2. **Slots 2–5 — One per unique day, preferring golden hours**: For each remaining unique day (up to 4 more days), pick the single best slot using this priority:
   - **Golden hours** (10:00–11:00 AM, 2:00–3:00 PM) → highest score
   - **Good hours** (9:00–12:00 PM, 1:00–5:00 PM) → medium score
   - **Edge hours** (before 9 AM, after 5 PM) → lowest score
3. Skip any day already represented by slot 1.

### UI enhancements

- Slot 1 gets a small `"Earliest available"` lilac badge/tag above the date.
- Remaining slots show just date + time as today.
- Keep existing styling and hover effects.

### Implementation detail

```
function selectSmartSlots(slots: TimeSlot[], max: number): (TimeSlot & { label?: string })[]
```

- Group all slots by date string (`YYYY-MM-DD`).
- First slot = `slots[0]`, labeled `"Earliest available"`.
- For remaining day groups (sorted chronologically, skipping first slot's day), score each slot's hour and pick the highest-scored one per day.
- Return up to `max` results.

## Files changed

| File | Change |
|------|--------|
| `src/components/booking/QuickSchedulePanel.tsx` | Add `selectSmartSlots` helper, render optional label badge on first slot |


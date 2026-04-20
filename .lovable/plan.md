

## Bug: No availability shown when candidate reschedules

### Root cause

This is a **regression from the availability-gating fix** deployed earlier today. Line 209 in `PublicBookingPage.tsx`:

```ts
const availabilityConfigId = (eventTypes.length > 0 && !selectedEventType) ? undefined : config?.id;
```

When a candidate clicks "Reschedule" from the existing booking view:
1. `rescheduleBookingId` is set → hides the existing booking view, shows the calendar
2. The reschedule link is contextual (`hasContextualLink = true`), so `showEventPicker` is `false` — the event type picker is never shown
3. No event type is auto-selected because the existing booking data doesn't carry `event_type_id`
4. So `selectedEventType` remains `null` while `eventTypes.length > 0` → `availabilityConfigId` becomes `undefined` → availability query is disabled → **no slots shown**

The candidate sees an empty calendar with no way to pick a time.

### Fix

**`src/pages/PublicBookingPage.tsx`** — two changes:

1. **Bypass the event-type gate for reschedule flows and contextual links.** When the candidate arrived via a contextual token (which already encodes the job/stage context), we should not block availability on event type selection — the token already scoped the booking. Change line 209 to:

   ```ts
   const availabilityConfigId = (eventTypes.length > 0 && !selectedEventType && !hasContextualLink)
     ? undefined
     : config?.id;
   ```

   This restores availability for all contextual flows (reschedule, direct candidate links) while still gating the general/public link path that caused the original bug.

2. **Auto-select event type from existing booking when rescheduling** (defense in depth). In the `handleReschedule` handler, if the existing booking has an `event_type_id` and it matches one of the loaded event types, pre-select it:

   ```ts
   const handleReschedule = () => {
     if (existingBooking) {
       setRescheduleBookingId(existingBooking.id);
       // Try to restore the original event type
       if ((existingBooking as any).event_type_id && eventTypes.length > 0) {
         const match = eventTypes.find((et: any) => et.id === (existingBooking as any).event_type_id);
         if (match) setSelectedEventType(match);
       }
     }
   };
   ```

### Files touched

1. `src/pages/PublicBookingPage.tsx` — 2 small edits (availability gate condition + handleReschedule)

No DB, edge function, or backend changes.


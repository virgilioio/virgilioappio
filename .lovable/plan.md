

## Show busy events in the calendar preview when scheduling with multiple interviewers (AND mode)

### Root cause

In `supabase/functions/get-booking-availability/index.ts`, the **GROUP/AND branch** (when `booking_config_ids` has 2+ hosts) does not include `busy_events` in its JSON response. Only `available_slots` is returned. The single-host internal branch already returns `busy_events`, which is why the preview works for one interviewer.

The function already fetches each host's busy slots (`busyResults`/`allBusy`) to filter availability — it just throws them away instead of returning them.

### Fix

**File:** `supabase/functions/get-booking-availability/index.ts`

In the GROUP branch response (around line 319), include the merged busy events from all hosts so the day calendar preview can render them — same shape as the single-host branch.

```ts
return new Response(JSON.stringify({
  available_slots: formattedSlots,
  busy_events: allBusy.map(s => ({
    start: s.start.toISOString(),
    end: s.end.toISOString(),
  })),
  total_slots: formattedSlots.length,
  date_range: { start: start_date, end: end_date },
}), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
```

That's the entire change. Frontend (`DayCalendarEvents`, `useBookingAvailability`, `ScheduleInterviewSheet`) already consumes `busy_events` and will render combined blocks for both interviewers automatically.

### Optional polish (only if needed after testing)

`DayCalendarEvents` currently labels each block only with start/end times. Combined calendars from two interviewers can show overlapping blocks. If overlaps look visually messy, a follow-up can:
- merge overlapping intervals before rendering, OR
- render each host's blocks side-by-side in two narrow lanes.

I'd recommend shipping the one-line fix first and only doing the polish if the preview looks crowded in practice.

### Verification

1. Open a candidate → Schedule Interview on a stage with 2 interviewers in AND mode → select a date → calendar preview now shows busy blocks (combined from both interviewers).
2. Stage with a single interviewer still shows busy events as today (no regression).
3. Public booking link is unaffected (it never returned `busy_events` and doesn't need to).
4. Available time-slot list in AND mode still correctly excludes any time when *either* interviewer is busy.

### Files touched

- `supabase/functions/get-booking-availability/index.ts` — return `busy_events` from the GROUP branch.


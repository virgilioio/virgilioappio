

# Allow Manual Scheduling Over Busy Times + Show Calendar Events

## Problem

When manually scheduling an interview (internal scheduling), the `get-booking-availability` edge function still filters out time slots that conflict with the interviewer's Google Calendar busy times. This forces the scheduler to pick a different time, then manually adjust in Google Calendar.

## Solution — Two Parts

### Part 1: Stop filtering busy slots for internal scheduling

**File: `supabase/functions/get-booking-availability/index.ts`** (lines 155-164)

When `internal_scheduling` is true, skip the busy-slot filtering. The edge function already generates unrestricted slots and skips booking rules for internal scheduling — but it still removes Google Calendar conflicts. Change the filtering logic so that when `internal_scheduling` is true, only existing GoGio bookings are excluded (to prevent double-booking within the platform), but Google Calendar busy times are ignored.

Additionally, return the busy slots in the response so the frontend can display them.

Updated response shape when `internal_scheduling` is true:
```json
{
  "available_slots": [...],
  "busy_events": [{ "start": "...", "end": "..." }],
  "total_slots": 42
}
```

### Part 2: Show interviewer's calendar events sidebar

**New file: `src/components/scheduling/DayCalendarEvents.tsx`**

A compact vertical timeline component that shows the interviewer's existing calendar events for the selected date. Styled like a mini day-view calendar:
- Time labels on the left (8am–8pm range)
- Busy blocks shown as colored bars with time range text
- GoGio bookings shown distinctly from external calendar events
- Scrollable area within a card

**File: `src/hooks/useBookingAvailability.ts`**

Update the return type to include `busy_events` from the response.

**Files: `src/components/candidates/ScheduleInterviewSheet.tsx` + `SimpleScheduleInterviewSheet.tsx`**

When a date is selected and time slots are shown, render the layout as a two-column grid:
- Left column: existing `TimeSlotsList` (available times to pick)
- Right column: new `DayCalendarEvents` showing what's on the interviewer's calendar that day

This gives the scheduler full context — they can see the interviewer's existing meetings and still book over them if needed.

### Part 3: Update MonthCalendar for internal scheduling

**File: `src/components/booking/MonthCalendar.tsx`**

Currently dates without available slots are disabled. For internal scheduling, all non-past dates should be selectable (since we're no longer filtering by busy times, most dates will have slots anyway, but edge cases like weekends with no working hours configured should still be clickable).

Add an optional `allowAllDates` prop that, when true, makes all current/future dates selectable regardless of `availableDates`.

## Technical details

- The `check-calendar-availability` function uses Google's FreeBusy API which returns only start/end times (no event titles). This is fine for showing busy blocks.
- To show event titles, we'd need to switch to Google Calendar Events List API — but for privacy and simplicity, showing anonymous busy blocks is the better approach (matches what Calendly does).
- The `create-booking` edge function does NOT validate against busy times — it just creates the event. So allowing the frontend to show "busy" slots doesn't break anything server-side.

## Files changed

| File | Change |
|------|--------|
| `supabase/functions/get-booking-availability/index.ts` | Skip Google Calendar busy filtering for internal scheduling; return busy_events in response |
| `src/hooks/useBookingAvailability.ts` | Add `busy_events` to response type |
| `src/components/scheduling/DayCalendarEvents.tsx` | New component — mini day timeline showing busy blocks |
| `src/components/candidates/ScheduleInterviewSheet.tsx` | Two-column layout for time slots + calendar events; pass `allowAllDates` to MonthCalendar |
| `src/components/candidates/SimpleScheduleInterviewSheet.tsx` | Same two-column layout change |
| `src/components/booking/MonthCalendar.tsx` | Add `allowAllDates` prop for internal scheduling |

## What stays untouched
- `create-booking` edge function — no validation changes
- `check-calendar-availability` — still called, but results used differently
- `TimeSlotsList` component — unchanged
- All booking confirmation forms — unchanged


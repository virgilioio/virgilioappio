# Reschedule: keep the details, cancel both invites

Two separate problems, both confirmed.

## 1. The reschedule sheet starts empty

`Reschedule` on the Current stage card opens the same sheet as a fresh schedule and passes only the booking's id (`oldBookingId`). The sheet never reads that booking, so every field initialises to its default: no interviewer, today's date, no slot, 30 minutes, video format, no guests, no message. Only the header copy changes ("Reschedule interview", "Send new invite").

**Fix:** when the sheet opens with an `oldBookingId`, load that booking and pre-fill it as the starting point:

- interviewer (or the panel, in group stages)
- the original date, so the calendar lands on that month/day
- duration, and the time block placed at the original start time
- format (video / phone / on-site) and the on-site address
- guest emails
- the invite message / notes

The recruiter then changes only what they need — typically just the time. Nothing is auto-submitted; the flow, the availability checks and the "bookable anyway" holds behave exactly as today. While the old booking loads, the WHEN section shows its existing skeleton.

The original time also gets a small "Currently scheduled" marker on the strip so it is obvious what is being moved, and it is not treated as a conflict against itself.

## 2. The candidate's calendar invite survives the cancellation

A booking creates **two** Google events on the interviewer's calendar: the internal one (`google_event_id`) and a candidate-only one (`candidate_google_event_id`). The internal reschedule calls `cancel-booking`, which deletes only the first. The candidate event is never deleted, so the old interview stays on the candidate's calendar — exactly what was reported.

This is confirmed in the data: of 45 bookings cancelled with a "Rescheduled…" reason, 39 still carry a candidate event id that was never deleted.

Note that the other two paths already do this correctly — `cancel-booking-public` and the reschedule branch inside `create-booking` both delete both events — so this is a gap in the internal cancel only.

**Fix:** `cancel-booking` deletes the candidate event too, right after the internal one, with the same 404-tolerant handling (an already-deleted event is not an error). This fixes plain cancellations as well as reschedules, since both go through this function.

Existing orphaned events from past reschedules are not touched by this change. If you want those cleaned up, say so and it can be a follow-up sweep.

## Technical notes

- `src/components/candidates/ScheduleInterviewSheet.tsx` — add a query for the old booking (enabled on `open && oldBookingId`), plus an effect that seeds interviewer / date / slot / duration / format / location / guests / message once per open. Reset on close as today.
- `src/components/candidates/AvailabilityStrip.tsx` — accept an optional "current booking" window to render as the origin marker and exclude from overlap detection.
- `supabase/functions/cancel-booking/index.ts` — inside the existing calendar block, issue a second DELETE for `booking.candidate_google_event_id`; redeploy the function.
- No schema, permission, email-template or mutation-shape changes. The create-then-cancel order stays as it is.



# Post-Booking Experience on Stage-Specific Booking Links

## Overview

When a candidate revisits a job+stage booking link after scheduling, they currently see the booking form again and can double-book. This plan adds three behaviors:

1. **Already booked** -- If an active (confirmed) future booking exists for this candidate+stage, show the booking details with reschedule/cancel controls instead of the calendar
2. **Past event** -- If the booking's scheduled time has passed (or the token itself expired), show a "link expired" message
3. **Cancelled** -- If the candidate cancels via the link, the token remains valid so they can rebook (until the event window passes)

## Detailed Changes

### 1. Update `resolve-booking-token` edge function

After resolving the token, also query `scheduled_bookings` for an existing confirmed booking matching `candidate_id + job_hiring_stage_id`. Return the booking data alongside the context:

```
response: {
  context: { ... },
  existing_booking: { ...booking fields } | null,
  token_status: 'active' | 'expired'
}
```

Also add a check: if a confirmed booking exists AND `scheduled_end` is in the past, return `token_status: 'expired'`.

If the token's `expires_at` has passed (already checked), the existing 404 behavior handles it.

### 2. New component: `src/components/booking/ExistingBookingView.tsx`

A public-facing card that displays existing booking details and action buttons. Shows:
- Interviewer info, date/time, duration, meeting location
- Download ICS button (reuse pattern from `BookingConfirmed`)
- **Reschedule** button -- returns the candidate to the calendar/time-slot picker with the existing booking ID tracked so `create-booking` can cancel the old one
- **Cancel** button -- calls a new public cancel endpoint, then shows a "cancelled" state with option to rebook

### 3. New edge function: `cancel-booking-public`

A lightweight public endpoint (no auth required, uses service_role) that:
- Accepts `{ token, booking_id }` 
- Validates the token is valid and matches the booking's candidate_id + job_hiring_stage_id
- Cancels the booking (updates status to 'cancelled', deletes Google Calendar event, sends cancellation emails) by reusing logic from `cancel-booking`
- Does NOT invalidate the token (so candidate can rebook)

### 4. Update `PublicBookingPage.tsx`

After resolving the token context, check for `existing_booking` in the response:

- If `existing_booking` exists and is in the future and status is `confirmed` -- render `ExistingBookingView` instead of the calendar
- If `token_status === 'expired'` -- show a "This link has expired" message
- If no existing booking or booking was cancelled -- show the normal calendar flow (current behavior)

Add a `rescheduleMode` state: when candidate clicks "Reschedule", store the old booking ID, show the calendar, and on successful new booking, the `create-booking` function cancels the old one.

### 5. Update `create-booking` edge function

Add an optional `reschedule_booking_id` parameter. When provided:
- Cancel the old booking (update status, delete calendar event, send cancellation emails)
- Create the new booking as usual
- This keeps the reschedule atomic from the candidate's perspective

### 6. Token expiry logic (compliance)

The token already expires after 90 days (DB default). The new addition: `resolve-booking-token` checks if an existing confirmed booking's `scheduled_end` is in the past. If so, it returns `token_status: 'expired'` and the frontend shows the expired page. This means:
- Before the interview: link shows booking details with controls
- After the interview: link is effectively dead
- No token stored in the DB needs to be modified

### Files Changed

| File | Change |
|------|--------|
| `supabase/functions/resolve-booking-token/index.ts` | Query for existing booking, return `existing_booking` and `token_status` |
| `supabase/functions/cancel-booking-public/index.ts` | New edge function for unauthenticated candidate cancellation (token-validated) |
| `supabase/functions/create-booking/index.ts` | Add optional `reschedule_booking_id` parameter to cancel old booking atomically |
| `src/components/booking/ExistingBookingView.tsx` | New component showing booking details + reschedule/cancel controls |
| `src/pages/PublicBookingPage.tsx` | Check for existing booking in token response, render `ExistingBookingView` or expired state |
| `src/lib/bookingLinkUtils.ts` | Update `resolveBookingToken` return type to include `existing_booking` and `token_status` |


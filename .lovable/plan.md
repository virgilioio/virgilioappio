# Let internal scheduling book over unavailable time

## What's happening

The Schedule interview sheet already tells you "you can book any time, including over a hold", and the server skips the working-hours / notice / grid checks when a recruiter books internally (it detects internal booking by the `booked_by_user_id` field).

But one guard is still applied to every booking, internal or not: a hard conflict check that rejects the request with a 409 if the interviewer already has a confirmed booking overlapping that time. That is the error toast you see ("Booking Failed" / "That time is already booked for this interviewer").

Confirmed in `supabase/functions/create-booking/index.ts`: the overlap query runs after the internal-scheduling bypass and returns 409 regardless of who is booking.

## Fix

Make the overlap check advisory for internal scheduling only:

- When the request comes from a recruiter booking internally, don't reject on overlap. Log the overlapping booking ids and continue creating the booking.
- When the request comes from a candidate self-booking on a public link (no internal booker), keep the 409 exactly as it is today — public double-booking stays blocked.

No changes to the availability strip, the invite/ICS content, calendar sync, or the existing overlap notice already shown in the sheet. No data model or permission changes.

## Technical notes

- File: `supabase/functions/create-booking/index.ts` — the conflict block that currently returns `409 This time slot is no longer available` becomes conditional on `!isInternalScheduling` (`isInternalScheduling` is already computed from `booked_by_user_id` earlier in the handler).
- Group bookings follow the same rule: overlap across any of the panelists' configs is tolerated for internal bookings, still blocked for public ones.
- Redeploy the `create-booking` function after the change.

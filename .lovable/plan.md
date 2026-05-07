## Problem

When a recruiter manually schedules an interview from a candidate's profile, the recruiter (the "booker") is not added to the Google Calendar event. The event invite goes only to: the primary interviewer, additional group interviewers, the transcript ingest email, guest emails, and the candidate. As a result, the recruiter who scheduled the meeting has no visibility of it on their own calendar.

## Fix

In `supabase/functions/create-booking/index.ts`, when `booked_by_user_id` is present and differs from the interviewer(s), include the booker as an attendee on the **interviewer's** Google Calendar event (not the candidate's event — candidate must not see who booked it).

### Steps

1. **Resolve booker email**: After we already load `booked_by_user_id`, fetch their email from `profiles` (`.select('email').eq('user_id', booked_by_user_id)`). Cache as `bookerEmail`.
2. **Add booker to the interviewer event attendees array** (lines ~598 and ~661 PATCH) — only if:
   - `bookerEmail` exists,
   - it isn't already the primary interviewer's email, and
   - it isn't already in the group attendees list.
3. **Do NOT add the booker to the candidate's calendar event** (lines ~726) — keep the candidate's invite scoped to the candidate only, matching current privacy behavior.
4. **No DB schema changes**. No frontend changes. The frontend already passes `booked_by_user_id`.

### Optional (small)

- Set `responseStatus: 'accepted'` for the booker so it appears confirmed on their calendar without an extra click.

## Out of scope

- Group booking flow already handles multiple interviewers; we are only adding the booker on top.
- Public booking links (no `booked_by_user_id`) are unaffected.
- Existing past bookings will not be backfilled (no Google API rewrite for historical events).

## Files

- `supabase/functions/create-booking/index.ts` — add booker email resolution and include in interviewer event `attendees` (insert + PATCH).

# Fix booking failures: patch `tg_notify_interview_event`

## Problem
Every public booking attempt for ALEJANDRO CARRILLO REAL (and any other candidate) fails in `create-booking` with:

```
column c.first_name does not exist
```

The error is raised by the `tg_notify_interview_event` trigger on `scheduled_bookings`. It queries `public.candidates` with `c.first_name` and `c.last_name`, but that table only has a `candidate_name` column. The INSERT is rolled back, so no booking is ever persisted.

A second latent bug in the same function: it queries `public.profiles` using `user_id = NEW.candidate_id`, but candidate IDs aren't auth user IDs. That branch silently returns NULL today, so it's not blocking — but it should be removed.

## Fix
One migration that replaces `tg_notify_interview_event` with a corrected version:

- Resolve candidate name from `public.candidates.candidate_name` (fallback to `NEW.candidate_name`).
- Drop the bogus `profiles` lookup by `candidate_id`; derive `actor_name` from the candidate name and leave `actor_avatar` NULL.
- Keep every other branch (event_kind detection, `emit_notification` call, payload) identical.

No code changes, no RLS changes, no edge function changes — strictly a DB function patch.

## Verification
After the migration, ALEJANDRO should be able to complete the booking from the public link. We'll confirm by re-checking `create-booking` edge logs for a clean run and that a row appears in `scheduled_bookings`.

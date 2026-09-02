# Candidate cancel / reschedule never reaches the Activity tab

## What's actually wrong

Confirmed root cause: the activity type used for cancellations does not exist in the database.

- The `activity_type` enum has `interview_scheduled` but **no** `interview_cancelled` (and no rescheduled type). Verified against the live enum.
- `cancel-booking-public` (the public link cancel) calls `log_activity` with `interview_cancelled`, the insert fails on the invalid enum value, and the error is swallowed by its `try/catch` — so nothing is ever written.
- The internal `cancel-booking` function has the same problem (direct insert with `interview_cancelled`).
- Result in the data: 360 cancelled bookings, **zero** activities of any interview-cancelled type.

Second gap: a **public reschedule** goes through `create-booking` with `reschedule_booking_id`. It cancels the old booking inline (no cancel activity) and logs the new one as a plain `interview_scheduled` with no indication it replaced an earlier time. So even once cancellations work, a reschedule would read as an unexplained new interview.

Third, minor: `cancel-booking-public` logs without `entity_type` / `entity_id`. The feed's lookup also matches on `metadata.candidate_id`, so it would still appear, but it should be consistent with every other candidate activity.

## The fix

1. Add two values to the `activity_type` enum: `interview_cancelled` and `interview_rescheduled`.

2. Public cancel (`cancel-booking-public`): keep the existing call, now valid, and add `entity_type: 'candidate'` + `entity_id: candidate_id`. Title reads as the candidate's own action ("Interview cancelled by <name>"), metadata keeps `booking_id`, `job_id`, `candidate_id`, `cancelled_by: 'candidate'`, plus the original `scheduled_start` and the reason.

3. Public reschedule (`create-booking`, reschedule branch): log one `interview_rescheduled` activity instead of a bare `interview_scheduled`, carrying the old and the new start time, both booking ids, and `rescheduled_by: 'candidate'` (or the recruiter's id for the internal path). The description reads "moved from <old> to <new>". Internal reschedules get the same treatment so both paths tell the same story.

4. Internal cancel (`cancel-booking`): the insert becomes valid with the new enum value, so recruiter-side cancellations start appearing too — same shape, `cancelled_by` set to the acting user.

5. Activity feed presentation: give the two new types an icon and colour (calendar-x for cancelled, calendar-clock for rescheduled, amber tone) so they don't fall back to the generic style.

Existing cancellations that were silently dropped cannot be recovered — the records were never written. Everything from the fix forward is captured.

## Technical notes

- Migration: `ALTER TYPE public.activity_type ADD VALUE IF NOT EXISTS 'interview_cancelled';` and `'interview_rescheduled'`. No table, policy or grant changes.
- `supabase/functions/cancel-booking-public/index.ts` — add entity fields and reason/start to the existing `log_activity` call; keep the try/catch but log loudly on failure.
- `supabase/functions/create-booking/index.ts` — in the reschedule branch, set the activity type and metadata for the rescheduled case; non-reschedule bookings keep logging `interview_scheduled` exactly as today.
- `supabase/functions/cancel-booking/index.ts` — unchanged shape, now succeeds; add `cancelled_by` label for parity.
- `src/utils/activityHelpers.tsx` — icon + colour entries for the two new types.
- No change to booking mutations, emails, calendar handling, tokens or permissions.

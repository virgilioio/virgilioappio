## What's happening

Hugo's two interviews exist in `scheduled_bookings` and RLS lets you read them (tenant-wide SELECT policy), but they were created via a **personal booking link** (`booking_config_id` set, `job_id` / `job_candidate_association_id` / `job_hiring_stage_id` all `NULL`). The second one also came in via `sync_source = google_calendar`.

`useStageBookings` filters strictly by `.eq('job_hiring_stage_id', jhsId)`, so any booking that didn't originate from the in-stage "Schedule" button — booking-link bookings, calendar-synced bookings, or bookings made before the candidate reached this stage — is invisible on the profile's Current stage card. That's why you don't see the event even though it's on your calendar and belongs to Hugo.

## Fix: broaden what the Current stage card considers "this candidate's interviews"

Read-side only. No booking-write changes, no RLS changes.

Update `src/hooks/useStageBookings.ts` so, in addition to strict-stage matches, it also surfaces bookings for the same candidate that are loosely linked to this job:

- Query all confirmed bookings for `candidate_id`, ordered by `scheduled_start`.
- Keep a booking when **any** of these is true:
  1. `job_hiring_stage_id === jhsId` (today's behavior), OR
  2. `job_id === jobId` and `job_hiring_stage_id IS NULL` (booked for the job but not tagged to a stage), OR
  3. `job_id IS NULL` and `job_hiring_stage_id IS NULL` and the booking's `scheduled_start` is at/after `enteredStageAt` for this candidate on this job (personal-link / calendar-synced bookings that happened while the candidate was in this stage).
- Everything downstream (attendees, interviewer profiles, scorecard aggregation) stays the same.

To support rule 3, `useStageBookings` needs `jobId` and the association's `entered_stage_at` (or `updated_at` on `job_candidate_associations` for the current stage). Extend the hook signature to `useStageBookings(jhsId, candidateId, { jobId, enteredStageAt })` and pass those from `CurrentStageCard` (both are already available there as props).

Realtime channel filter (`candidate_id=eq.${candidateId}`) already covers all of these — no channel change needed.

## Not in scope

- Fixing the write path so booking-link / Google-Calendar-created bookings automatically populate `job_id` / `job_candidate_association_id` / `job_hiring_stage_id` when the candidate is already on a job. Worth doing later, but a bigger change touching `create-booking`, `resolve-booking-token`, and the Google Calendar webhook — call it out separately if you want it.
- The unrelated `useStageBookingInterviewers` "Maximum update depth exceeded" warning already visible in the console.

## Files touched

- `src/hooks/useStageBookings.ts` — widen query + filter, extend signature.
- `src/components/candidates/profile/CurrentStageCard.tsx` — pass `jobId` and `enteredStageAt` into the hook.

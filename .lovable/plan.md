## Diagnosis

Hugo’s scheduled booking does exist and is readable:

- Candidate: `Hugo Sanchez Rasgado`
- Booking: `077ff2a3-28a2-440f-a7af-c9f97973f78c`
- Time: `2026-07-07 23:00–23:30 UTC`
- Status: `confirmed`
- Interviewer/organizer: Allan Bravo
- `candidate_id` is correctly set
- But `job_id`, `job_candidate_association_id`, and `job_hiring_stage_id` are all `NULL`

The previous read-side fix still misses this booking because Hugo’s `job_candidate_associations.entered_stage_at` is also `NULL`. The hook only includes unlinked personal/calendar bookings when `scheduled_start >= enteredStageAt`, so with no `enteredStageAt`, rule 3 never runs.

## Plan

1. **Add a fallback stage window start**
   - In `CandidateProfileSheet.tsx`, also fetch the association `created_at`.
   - Keep the display value as `entered_stage_at`, but pass a matching fallback to the Current Stage card:
     - `entered_stage_at ?? association.created_at`

2. **Extend `CurrentStageCard` options cleanly**
   - Add a prop like `stageWindowStartAt` for matching logic.
   - Continue using `enteredStageAt` for UI text so we don’t fake “started” dates when the explicit value is missing.

3. **Update `useStageBookings` loose-match logic**
   - Use `stageWindowStartAt` for personal-link / Google Calendar synced bookings where:
     - `job_id IS NULL`
     - `job_hiring_stage_id IS NULL`
     - `candidate_id` matches
     - `scheduled_start >= stageWindowStartAt`
   - Keep the existing strict matches for stage-tagged and job-tagged bookings.

4. **Keep this read-side only**
   - No RLS changes.
   - No booking creation/sync changes.
   - No migration needed.

## Expected result

Hugo’s confirmed Allan Bravo interview should appear in the in-job candidate profile under:

`Job overview → Current stage → Recruiter Screening → Next event`

because the booking has the correct `candidate_id`, is confirmed, and happened after the candidate association was created, even though the calendar-sync row lacks job/stage linkage.
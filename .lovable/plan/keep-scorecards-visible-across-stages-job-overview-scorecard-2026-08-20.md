# Keep scorecards visible across stages (Job overview → Scorecards)

## What's wrong today (verified in code)

The Scorecards card on the in-job profile's Job overview tab is hard-scoped to the candidate's **current** stage:

- `CandidateProfileSheet.tsx` renders `<StageScorecardsCard stageInstanceId={currentStage.jhsId} ...>` and only when the current stage type supports scorecards.
- `StageScorecardsCard` fetches with `useAllStageScorecards(stageInstanceId, associationId)`, which filters `job_stage_scorecards` by `stage_instance_id`.
- The "required to advance" data comes from `useStageScorecardRequirement(activeStage, association)` — single stage only.

So when a candidate advances, every submitted scorecard from earlier stages vanishes from that card, and any still-unsubmitted (required) scorecards from earlier stages stop being reported at all. The data is intact in the database — this is a fetch/scope problem, not data loss.

(The Scorecards *tab* already uses `useAssociationScorecards`, which reads every stage — so that hook and its visibility rules can be reused here.)

## The fix

Turn the single-stage card into an application-wide, stage-grouped card.

1. **Show all submitted scorecards, grouped by stage.**
   Feed the card from `useAssociationScorecards(associationId)` (all stages, per-stage visibility already applied) instead of `useAllStageScorecards(stageInstanceId)`. Group rows by their stage, ordered current stage first, then earlier stages descending by position. Each group gets a small stage header row (stage name + submitted/pending counts) so it's obvious which stage a score belongs to.

2. **Keep pending/required scorecards visible after the candidate moves on.**
   Add a new hook `useApplicationScorecardRequirements(associationId, jobId)` that runs the same computation `useStageScorecardRequirement` does, but for **every** stage of the application the candidate has reached (position <= current stage position) where `require_scorecard` is on or where expected panelists exist:
   - expected set = non-cancelled `scheduled_bookings` interviewer + `scheduled_booking_attendees`, falling back to `stage_interviewer_assignments`
   - minus whoever already submitted a real (non-AI-draft, rated) scorecard for that stage
   - joined to `scorecard_reminder_sends` for the "requested Xd ago" text
   The existing single-stage hook stays untouched for its other call sites; the new hook reuses the same queries in batch form (one query per table, `.in(...)` over the reached stage ids) to avoid N round-trips.

3. **Stage-scoped labels and actions.**
   The "Scorecard required to advance" banner keeps its current styling for the current stage. For earlier stages the same row set renders as an amber-free, neutral "Still pending from <stage>" group with per-person **Request** / **Request all** buttons — `requestScorecard` already takes the stage instance id, so each group passes its own stage. Opening a scorecard passes that scorecard's own stage id (so `ScorecardSheet` opens with the correct stage), instead of always the current stage.

4. **Card is no longer hidden by stage type.**
   Today the whole card only renders when the *current* stage supports scorecards, so a candidate sitting in e.g. Offer sees nothing. Change the condition to: render whenever there is at least one submitted or pending scorecard across the application, or the current stage supports scorecards.

## Explicitly unchanged

- No database migration, no schema change, no RLS change. Existing visibility rules (private vs public per stage, admin/recruiter override) are preserved exactly as `useAssociationScorecards` implements them.
- The advance gate (`checkScorecardGate`) and reminder/request backend stay as-is.
- The Scorecards tab, the sidebar summary, and the compare view keep their current behaviour.

## Files touched

- `src/hooks/useApplicationScorecardRequirements.ts` (new)
- `src/components/candidates/profile/StageScorecardsCard.tsx` — grouped rendering, per-group requirement + actions
- `src/components/candidates/CandidateProfileSheet.tsx` — pass application-wide data, per-scorecard stage on open, relax the render condition

## Verification

Open an in-job profile for a candidate who has a submitted scorecard in an earlier stage and is now in a later stage: earlier scorecards appear under their stage heading, unsubmitted ones still show as pending with a working Request action, and the current stage's required banner behaves as before.

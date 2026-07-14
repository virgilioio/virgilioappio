## Problem

Transferring a candidate to another job errors with **"Candidate already exists in target job"**. Confirmed in the DB: candidate `f90aed39…` has active associations in *both* the source job (`fd6007cb…`) and the target job (`bee1537d…`). The `transfer-candidate` edge function hard-fails in that case (lines 78–82 of `supabase/functions/transfer-candidate/index.ts`), so the transfer aborts and nothing moves.

Add works fine because it just calls `createAssociationAndMove` and doesn't do the pre-check.

## Root cause

`transfer-candidate` assumes the candidate is **not yet** in the target job. When they are already there (added directly, previously transferred, or added through Move-to-pipeline), the function throws instead of merging.

## Fix (edge function only — no UI, no schema change)

Update `supabase/functions/transfer-candidate/index.ts` to **merge into the existing target association** instead of erroring:

1. Query the target association with `.maybeSingle()` as it does today.
2. If it exists:
   - **Do not** insert a new association.
   - Treat that existing row as `newAssociation`.
   - If the caller passed `targetStageId`, update the existing association's `current_stage_id` to it (respect the stage the user picked in the dialog). Leave `status`, `notes`, `added_by` untouched so we don't overwrite the target's own history.
3. If it doesn't exist: keep today's insert path unchanged.
4. Everything downstream (comments, email logs, scorecards, activities, scheduled bookings re-parenting, and finally deleting the **source** association) runs the same way, now pointing at whichever association id we ended up with.
5. Keep all existing logs; add one info log for the "merged into existing target association" branch so we can see it in function logs.

Response shape stays `{ success, newAssociationId, message }` — `newAssociationId` will be the existing target association id in the merge case, which is what the client already uses to navigate.

## Out of scope

- No changes to `AddOrTransferCandidateDialog`, `useCandidateTransfer`, `usePipelineActions`, or any other component.
- No new backend, no new fields, no schema migration.
- No change to Add behavior.
- No new pre-check in the dialog to hide/disable Transfer when the candidate is already in the target — behavior stays "user clicks Transfer, we do the right thing on the server."

## Verification

- Retry the failing transfer (candidate `f90aed39…`, source `fd6007cb…`, target `bee1537d…`): expect success, source association deleted, target association retained with `current_stage_id` set to the picked stage, and comments/emails/scorecards/bookings now pointing at the target.
- Transfer a candidate that is **not** already in the target: unchanged from today.
- Function logs show either "New association created" or the new "Merged into existing target association" line, then the usual transfer steps.

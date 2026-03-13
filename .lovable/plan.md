
Problem confirmed from runtime evidence:
- The latest console snapshot includes:
  - `Failed to reject candidate: FunctionsFetchError (Failed to fetch)` from `useRejectCandidate.ts`
  - `Rejection failed:` from `useApplicationReview.ts`
- This explains your exact symptom: the DB rejection/email side-effect can happen, but the sheet UI does not progress because `handleReject` exits in `catch` before local queue/state updates.

Plan to fix

1) Make Application Review rejection UI resilient to post-rejection transport errors
- File: `src/hooks/useApplicationReview.ts`
- In `handleReject`, capture the current candidate in a local const and add a small helper to “finalize reject locally” (increment stats, set `hasActioned`, remove from queue).
- Keep current success path unchanged.
- In `catch`, perform a reconciliation check:
  - Query `job_candidate_associations` for that `associationId`.
  - If status is already `rejected`, still run local finalize helper so the sheet advances to summary.
  - Show a warning toast like: “Candidate was rejected, but email/send confirmation failed.”
  - If not rejected, keep existing error behavior.

2) Prevent false “stuck” states caused by email transport ambiguity
- File: `src/hooks/useRejectCandidate.ts` (small adjustment)
- Keep throwing for true rejection failures (association fetch/update).
- For email send failures after rejection update, return a partial-success result instead of hard-failing the whole mutation (or at minimum expose enough metadata so caller can distinguish).
- This avoids blocking UI progression when core rejection succeeded.

3) Validation pass
- Re-test single-candidate flow in Application Review:
  - Reject with email ON.
  - Verify candidate leaves screen immediately and completion summary appears.
  - Verify both paths:
    - normal send success
    - simulated email invoke/network failure (UI should still progress if association is rejected).

Technical details
- No DB schema/RLS changes required.
- No edge function changes required.
- Scope is frontend hook logic only (`useApplicationReview.ts`, optionally `useRejectCandidate.ts`).


Goal: fix the “declined banner + old decline note persists after Recall” bug by ensuring the UI reads the latest approval request state (including recalled), not an older declined one.

What’s happening now
- In `useOfferApprovalRequest.ts`, the fetch query filters to `['pending', 'approved', 'declined']`.
- After you recall a request, latest request becomes `recalled`, so it is excluded.
- The hook then falls back to an older `declined` request, and `CandidateOfferDetails` renders that old decline banner/note.

Implementation plan

1) Fix source-of-truth query in `src/hooks/useOfferApprovalRequest.ts`
- Update approval request fetch filter to include recalled state:
  - from: `['pending', 'approved', 'declined']`
  - to: `['pending', 'approved', 'declined', 'recalled']`
- Keep ordering by newest (`created_at desc`) + `limit(1)` so the latest lifecycle state is always used.

2) Add immediate UI consistency on recall success (same file)
- In `recallApprovalMutation.onSuccess`, keep invalidation/events as-is, and also set local React Query cache for `queryKey` to status `recalled` (and steps already recalled where applicable) to prevent any transient stale render.

3) Keep declined banner guard in `src/components/candidates/CandidateOfferDetails.tsx`
- Preserve existing condition:
  - `approvalRequest?.status === 'declined' && offerLetter.status === 'draft'`
- With step #1, this condition will correctly evaluate false after recall (latest request is recalled), so old decline note disappears.

4) Validate end-to-end scenarios
- Scenario A: declined request exists historically → create new request → recall it.
  - Expected: no declined banner/note after recall.
- Scenario B: decline then edit/re-request approval.
  - Expected: pending flow shows; old decline note not shown.
- Scenario C: historical declined request with no new request.
  - Expected: declined banner still visible (intended historical state).

Technical notes
- `ApprovalRequest` type already includes `'recalled'`, so this is mainly a query-selection bug, not a schema/type bug.
- This change aligns `CandidateOfferDetails` and `CandidateOfferApprovals` with true latest request lifecycle.

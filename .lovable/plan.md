

# Fix Offer Edit When Already Approved — Restart Approval, Delete Document, Live UI Update

## Problems Identified

1. **Approval restart only triggers for `pending_approval`** (line 98 in `OfferComposerBody.tsx`), but not for `approved` status. Editing an approved offer should also restart the approval process.
2. **The generated offer document is not deleted** when approval is restarted. The old document becomes stale/invalid.
3. **No live UI update**: `useOfferLetters` uses `useState`/`useEffect` (not React Query), so `queryClient.invalidateQueries({ queryKey: ['offer-letters'] })` in the recall mutation does nothing. The `CandidateOfferDetails` component won't reflect the status change until a manual refresh.

## Changes

### 1. `src/components/candidates/OfferComposerBody.tsx` — Handle approved offers

Expand the restart logic (lines 96-109) to also handle `approved` status:
- Change condition from `currentOffer?.status === 'pending_approval'` to include `approved`
- For `approved` offers (no active approval request to recall), directly update the offer status back to `draft`
- Delete the generated offer document (from `candidate_attachments` table and storage) when restarting
- Also pass `approvalRequest` for approved offers (fix line 63-64 where the hook only loads for `pending_approval`)

### 2. `src/components/candidates/OfferComposerBody.tsx` — Fix `useOfferApprovalRequest` hook usage

Currently line 63-64 only passes `editingOfferId` to the hook when status is `pending_approval`. Change to also pass it when status is `approved`, so the approval request data is available for recall.

### 3. `src/hooks/useOfferLetters.ts` — Enable live UI updates

The hook uses `useState`/`useEffect` pattern. After `updateOfferLetter` completes, it already calls `fetchOfferLetters()`. The issue is that the `CandidateOfferDetails` component creates its own instance of `useOfferLetters`, so it doesn't share state. Fix by dispatching a custom event (like the existing `refetch-attachments` pattern) after offer updates, and listening for it in `useOfferLetters`.

Alternatively, add a window event `refetch-offer-letters` that the hook listens for, and dispatch it from the save handler.

### 4. `src/components/candidates/OfferComposerBody.tsx` — Delete offer document on restart

When restarting approval from an approved state:
- Query `candidate_attachments` for the offer document (matching `Offer Letter%` by file_name)
- Delete from storage bucket `candidate-attachments`
- Delete the row from `candidate_attachments` table
- Dispatch `refetch-attachments` event so the UI updates

### 5. Console error fix

The console shows `invalid input value for enum activity_type: "offer_updated"`. This means the `activity_type` enum in the database doesn't include `offer_updated`. Either add it via migration, or change the log call to use an existing enum value.

## Summary of file changes

| File | Change |
|------|--------|
| `OfferComposerBody.tsx` | Expand restart logic to handle `approved` status; delete offer document; fix hook usage; dispatch refetch events |
| `useOfferLetters.ts` | Add window event listener for `refetch-offer-letters` to enable cross-component refetching |
| DB migration | Add `offer_updated` to the `activity_type` enum |




# Fix: Declined Note Persisting After Approval Restart

## Root Cause

Two related issues:

1. **`requestApprovalMutation.onSuccess`** (in `useOfferApprovalRequest.ts`, lines 165-169) calls `queryClient.invalidateQueries({ queryKey: ['offer-letters'] })`, but `useOfferLetters` uses `useState`/`useEffect` — not React Query. So the offer letter status in `CandidateOfferDetails` never refreshes after re-requesting approval. The `refetch-offer-letters` window event (added earlier) is NOT dispatched here.

2. **The declined banner** in `CandidateOfferDetails.tsx` (line 200) only checks `approvalRequest?.status === 'declined'`. Even after the approval request query refetches and returns the new pending request, if the `useOfferLetters` data is stale, the offer status badge still shows "draft" instead of "pending_approval." More critically, if the React Query cache returns the old declined request during a brief window, the banner with decline notes flashes.

## Changes

### 1. `src/hooks/useOfferApprovalRequest.ts` — Dispatch `refetch-offer-letters` in `requestApprovalMutation.onSuccess`

Add `window.dispatchEvent(new CustomEvent('refetch-offer-letters'))` to the `onSuccess` callback of `requestApprovalMutation` (line 166). This ensures `CandidateOfferDetails` (which uses `useOfferLetters`) picks up the status change from `draft` to `pending_approval` immediately.

Also add it to `recallApprovalMutation.onSuccess`, `approveStepMutation.onSuccess`, and `declineStepMutation.onSuccess` for consistency — all these mutations change the offer letter status.

### 2. `src/components/candidates/CandidateOfferDetails.tsx` — Guard declined banner with offer status

At line 200, add an additional condition: only show the declined banner when the offer letter's status is `draft` (not `pending_approval`). This prevents the stale banner from showing when a new approval has already been requested:

```tsx
{approvalRequest?.status === 'declined' && offerLetter.status === 'draft' && (
```

This is a defense-in-depth measure — even if there's a brief cache inconsistency, the banner won't show once the offer status updates to `pending_approval`.

## Summary

| File | Change |
|------|--------|
| `useOfferApprovalRequest.ts` | Dispatch `refetch-offer-letters` in all mutation `onSuccess` callbacks |
| `CandidateOfferDetails.tsx` | Add `offerLetter.status === 'draft'` guard to declined banner |


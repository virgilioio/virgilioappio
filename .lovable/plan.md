

# Fix: Show Completion Screen After Rejecting Last Candidate

## Problem

When the last (or only) candidate is rejected/advanced, they're removed from the queue array. This makes `queue.length === 0`, and the render logic hits `totalInQueue === 0 → EmptyState` before it ever checks `isComplete`. The user sees "no candidates to review" instead of the session summary screen.

## Fix

**File: `src/hooks/useApplicationReview.ts`**

Track whether any actions were taken during the session so we can distinguish "empty queue on load" from "processed all candidates":

- Add state: `const [hasActioned, setHasActioned] = useState(false)`
- Reset it in `loadQueue`: `setHasActioned(false)`
- Set it to `true` in `handleReject`, `handlePass`, and `handleAdvance` on success
- Change `isComplete`: `const isComplete = hasActioned && currentCandidate === null`

This way, `isComplete` is true when the user has done at least one action and there's no candidate left to show.

**File: `src/components/candidates/ApplicationReviewSheet.tsx`**

Swap the render priority so completion is checked before empty:

```
review.isLoading ? <LoadingState />
: review.isComplete ? <CompletionState ... />
: review.totalInQueue === 0 ? <EmptyState ... />
: review.currentCandidate ? <ReviewContent ... />
```

Two files, ~6 lines changed total.


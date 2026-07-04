In `ProfileQuickActionsCard.tsx`, change the condition that renders the "Create offer" button from `!isRejected && !isHired` to `isOfferStatus`. This ensures the button only appears when the candidate is at the offer stage.

**File:** `src/components/candidates/profile/ProfileQuickActionsCard.tsx`
**Change:** Wrap the purple "Create offer" `<Button>` with `{isOfferStatus && (...)}` instead of `{!isRejected && !isHired && (...)}`.
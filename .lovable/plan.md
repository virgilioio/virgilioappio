Increase the vertical spacing above the bottom action row on the Review complete screen so the "Start outreach to advanced" and "Done" buttons are visually separated from the shortlist/piles above them.

**Change**
- In `src/pages/ApplicationReview.tsx`, inside the `CompletionState` component, update the footer button wrapper from `mt-[30px]` to `mt-12` (48px) to match the breathing room shown in the reference screenshot.

**Verification**
- Run `bunx tsgo --noEmit` to confirm no TypeScript regressions.
- Visually confirm in the preview that the buttons sit lower and no longer feel cramped against the candidate list.
# Fix candidate card title overflow in pipeline

## Problem
In the job details pipeline tab, candidate cards become vertically oversized when the candidate’s most recent title (role) is very long. The role/company text should stay on a single line with an ellipsis and not stretch the card.

## What I’ll change
1. Audit the board card (`src/components/jobs/CandidateCard.tsx`) and the list row (`src/components/jobs/PipelineListView.tsx`) to confirm where the long text is rendered.
2. Add the missing width constraints so `truncate` actually takes effect:
   - Ensure every flex ancestor that holds the text has `min-w-0` and `max-w-full`.
   - Ensure the grid cell that holds the candidate block in the list view has a constrained width (`min-w-0` + `overflow-hidden` if needed).
3. Keep the visual design unchanged:
   - Same fonts, colors, spacing, hover states, checkbox behaviour, and status badge layout.
   - Only the role/company line becomes single-line with `…` truncation.
4. Add `title` attributes to the truncated role and name elements so recruiters can still read the full text on hover.
5. If the role and company together still feel too tall, evaluate combining them into a single truncated line (`Role @ Company`) in the board card while keeping the existing information.

## Verification
- Run a typecheck/build to confirm no regressions.
- Inspect the pipeline board and list views in the preview with a long mock role string to confirm the card height stays consistent and the ellipsis appears.
- Confirm the full text is still accessible via the native `title` tooltip.



# Application Review Sheet UI Changes

Three changes to `src/components/candidates/ApplicationReviewSheet.tsx`:

## 1. Remove the top "Application Review" header bar
Remove the entire header block (lines 78-105) containing "Application Review", job title, progress bar, counter badge, and close button. Move the counter badge, progress bar, and close button into the candidate header (SheetHeader). Add the job title as a line below the candidate name.

## 2. Reorganize Column 3 — Review Controls
Move the action buttons **above** the rejection config panel instead of pinned at the bottom. Add a rejection email template selector dropdown (using `useRejectionEmailTemplates`) to the RejectionConfigPanel, so users can pick which email template to use. The selected template ID will be added to the `RejectionConfig` interface in `useApplicationReview.ts`.

## 3. Three buttons in a single row
Replace the current two-row button layout with a single row: `Reject | Pass | Advance`, all sharing equal width.

## Files Modified
- **`src/components/candidates/ApplicationReviewSheet.tsx`** — All three UI changes
- **`src/hooks/useApplicationReview.ts`** — Add `rejectionEmailTemplateId` to `RejectionConfig`

## Technical Details

**Header restructure**: The close button (X), counter badge ("3 of 12"), and progress bar move into the SheetHeader alongside candidate name and nav buttons. Job title renders as `text-sm text-text-secondary` below the candidate name, above the metadata chips.

**Email template selector**: A new `<Select>` dropdown populated by `useRejectionEmailTemplates('organization')`, added to `RejectionConfigPanel`. Its value is stored as `rejectionEmailTemplateId` in `RejectionConfig` and persists across candidates (same as rejection reason).

**Button row**: All three buttons in a single `flex gap-2` row with `flex-1` sizing. Order: Reject (destructive) | Pass (outline) | Advance (default).


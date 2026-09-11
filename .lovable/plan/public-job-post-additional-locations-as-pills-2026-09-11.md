# Public job post · Additional locations as pills

## Goal
Restructure the right-side summary card on public job posts so that additional locations appear as a single "Additional locations" row with inline pills, instead of one repetitive row per location.

## Current state
- `src/pages/PublicJobPosting.tsx` builds `summaryRows` with one `Additional location` row per entry in `details.additionalLocations`.
- `src/components/careers/public/job/JobAsideSummary.tsx` renders each row as a label/value pair; the value is a plain string.

## Proposed change
1. Extend `JobAsideSummary` row value type to accept `string | string[] | null`.
   - When value is an array, render each item as a small pill/chip inline, wrapping only if the row overflows.
   - Empty arrays are treated as null (row hidden).
   - Keep label/value layout unchanged for scalar rows.
2. Update `PublicJobPosting.tsx` `summaryRows`:
   - Keep `Primary location` and `Work model` as separate rows.
   - Replace the spread of per-location rows with a single `Additional locations` row whose value is `details.additionalLocations`.
   - Only include the row when there is at least one additional location.
3. No data/API changes; posting details shape and public query remain the same.

## Files to edit
- `src/components/careers/public/job/JobAsideSummary.tsx`
- `src/pages/PublicJobPosting.tsx`

## Verification
- TypeScript build passes.
- Public job post with zero, one, and multiple additional locations renders cleanly.
- Primary location and work model rows continue to display as before.

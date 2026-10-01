# Fix the Rejected table: reason, decided by, date, and sorting

## What's wrong
All 80 rejected candidates on this job already have a saved reason, who rejected them, and when. The table just never loads those details, so "Reason" shows "No reason recorded" and "Decided by" is blank. The "Rejected" date column has the same problem, so it shows no date or the wrong one.

## Changes
1. **Reason** shows the real saved reason (e.g. "Unresponsive", "Skills mismatch"), with any rejection notes underneath.
2. **Decided by** shows the name and avatar of the team member who rejected the candidate.
3. **Rejection date** column, renamed from "Rejected" to "Rejected on", shows the real rejection date (e.g. "Sep 24").
4. **Sort button** next to the filter button above the table. Options:
   - Rejection date (newest first, the default, or oldest first)
   - Name (A–Z / Z–A)
   - Match score (highest / lowest)
   - Reason (A–Z)
   - Decided by (A–Z)
   The button shows the current sort, e.g. "Sort: Newest rejected". The sort only applies to the Rejected tab for now.

## Technical details
- `usePipelineActions.fetchAssociationsForJob`: add `rejection_reason_id, rejected_by, rejected_at, rejection_notes, updated_at, offered_at, hired_at` to the association select. `usePipelineSectionRows` already resolves the reason and the owner from these fields. Adding the fields also fixes the dates on the offers and hired tabs.
- Rows gain raw sort keys: `rejectedAt`, `name`, `score`, `reasonLabel`, `ownerName`.
- `PipelineToolbar`: new optional `sort` slot rendered beside the filter control, using a `DropdownMenu` (align end, follows the Dropdowns foundation) with a secondary sm button.
- `PipelineFlatSection`: keeps the sort state and sorts rows before rendering. The sort is enabled only when `section === 'rejected'`.

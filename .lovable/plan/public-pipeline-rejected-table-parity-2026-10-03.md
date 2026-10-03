# Public pipeline — rejected table parity

## What will change
When a client opens the **Rejected** section of a shared pipeline, its candidate table will match the internal rejected table’s data columns:

1. **Candidate** — candidate name, current role, company, and avatar/initials.
2. **Match** — Gio Fit score.
3. **Reached** — furthest pipeline stage reached.
4. **Rejected on** — the saved rejection date, replacing the current “Closed” label.
5. **Reason** — the exact internal rejection reason, including the supporting rejection note shown internally.
6. **Decided by** — the actual team member’s name and avatar.

The public table will use the same visual hierarchy as the internal rows for the reason and decision-maker. Clicking a row will continue to open the existing client dossier.

## Existing sharing controls
- The Rejected section still appears only when it is enabled in Client view settings.
- Existing candidate-name, employer, Gio Fit, and rejection-reason visibility settings remain authoritative. When a field is disabled, its corresponding public column stays hidden.
- Because you selected **Exact internal details**, enabled rejection reasons will use the internal reason and note rather than the client-safe label, and **Decided by** will expose the team member’s real identity.
- Internal checkboxes, row menus, bulk actions, and destructive actions will not be added to the public table.

## Technical details
- Expand the `pipeline-public` allowlist for rejected rows to fetch `rejection_notes`, `rejected_by`, the internal rejection reason name/category, and the rejecting member’s public profile name/avatar.
- Serialize only the fields needed by the six public columns; keep association IDs, candidate IDs, and unrelated internal workflow data stripped from the anonymous response.
- Match the internal fallback logic for withdrawn, auto-screened, and missing-reason rows, and continue using `rejected_at` with the existing fallback for older records.
- Update the public pipeline row types, rejected-column layout, reason treatment, and owner cell.
- Keep the current newest-rejected-first ordering; sorting controls are outside this request.

## Verification
- Check an enabled public Rejected section against the same job internally and confirm each visible row matches across all six columns.
- Confirm visibility switches still hide Gio Fit, employer, or reason data as configured.
- Confirm rows without a reason, note, owner, avatar, or saved rejection date render safe fallbacks without breaking the table.
- Validate that the public response contains no fields beyond the explicit allowlist and that the edge function and frontend build cleanly.

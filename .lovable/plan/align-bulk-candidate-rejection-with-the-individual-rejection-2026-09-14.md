# Align bulk candidate rejection with the individual rejection dialog

## Goal
Use the individual rejection dialog itself as the canonical rejection experience for both one candidate and many candidates, with only the data, count-aware wording, and submission handler changing in bulk mode.

## Changes
- Extract the individual dialog’s complete presentation and interaction flow into one shared rejection-dialog experience rather than recreating it in the bulk file.
- Have the existing individual flow render that shared experience with its current candidate details and single-candidate mutation.
- Have the bulk flow render the same shared experience with the selected count, plural wording, bulk association lookup, and bulk mutation.
- Keep the exact individual structure in both modes: 600px frame, header, reason groups and recent chips, progressive note disclosure, email toggle card, template/sender/editors, send-time cards and presets, amber validation strip, and fixed footer.
- Add only bulk-specific content where necessary: count-aware impact copy, per-recipient personalization guidance, plural footer labels, and an in-place progress state that does not alter the layout.
- Use the shared Gio buttons in the footer: secondary Cancel and a final solid-danger confirmation whose label reflects reject-only, send-now, or scheduled-email behavior.

## Preserve
- Keep the existing bulk association lookup, candidate filtering, per-candidate placeholder personalization, interview cancellation, scheduling, progress tracking, partial-failure reporting, query refreshes, and saved rejection preferences.
- Keep the existing individual and bulk submission rules, mailbox connection path, and separate mutations; the shared layer owns the interface while each mode keeps its established operation.
- Keep the dialog usable at shorter viewport heights through internal scrolling and a stable header/footer.

## Verification
- Compare individual and bulk dialogs side by side to confirm they are the same shared interface, differing only in candidate/count wording and progress feedback.
- Test reject-only, send-now, schedule-later, missing-email-fields, no-mailbox, loading, progress, success, partial failure, cancel, Escape, and keyboard submit states.
- Confirm selected counts pluralize correctly, the layout remains stable on desktop and mobile-width viewports, and the current build remains clean.

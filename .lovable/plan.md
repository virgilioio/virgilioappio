# Align bulk candidate rejection with the individual rejection dialog

## Goal
Make the bulk rejection dialog feel like the same Gio workflow as the individual rejection dialog, adapted only where multiple candidates require different copy or controls.

## Changes
- Rebuild the bulk dialog with the individual dialog’s 600px framed layout: dimmed overlay, red rejection icon block, compact uppercase context, Poppins title, explanatory copy, scrollable body, and fixed footer.
- Adapt the header and descriptions for the selected count, clearly explaining that every selected candidate will be removed from this job while their profiles and history remain available.
- Match the individual reason section, including grouped rejection reasons, recent-reason chips, the internal-only note, and the progressive “Add a note for the hiring team” disclosure.
- Match the individual email section: the same lilac toggle card, template and sender controls, subject/message editors, personalization guidance for bulk recipients, and the same immediate-versus-scheduled choice layout.
- Use the same amber incomplete-email notice and footer status language, with plural wording and the existing bulk progress indicator integrated without shifting the dialog.
- Use the shared Gio buttons in the footer: secondary Cancel and a final solid-danger confirmation whose label reflects reject-only, send-now, or scheduled-email behavior.

## Preserve
- Keep the existing bulk association lookup, candidate filtering, per-candidate placeholder personalization, interview cancellation, scheduling, progress tracking, partial-failure reporting, query refreshes, and saved rejection preferences.
- Keep the existing bulk submission rules and mailbox connection path; this is a presentation and interaction-structure change, not a mutation or data-model change.
- Keep the dialog usable at shorter viewport heights through internal scrolling and a stable header/footer.

## Verification
- Compare individual and bulk dialogs side by side for matching hierarchy, spacing, controls, states, and wording patterns.
- Test reject-only, send-now, schedule-later, missing-email-fields, no-mailbox, loading, progress, success, partial failure, cancel, Escape, and keyboard submit states.
- Confirm selected counts pluralize correctly, the layout remains stable on desktop and mobile-width viewports, and the current build remains clean.

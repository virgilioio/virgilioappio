# Restyle the Mark hired dialog

## What will change
- Rebuild the existing dialog presentation as a centered 480px, calm white surface with the specified header, opening cards, attribution pickers, date field, impact notes, and footer.
- Keep the existing opening eligibility, offer-based preselection, date defaults, required attribution, close-job control, RPC payload, error handling, and success callback unchanged.
- Add the deal-only success-fee note using the job/opening and accepted-offer values already associated with this hire; hide unavailable salary detail as specified.
- Replace the current success notification with the requested bottom-center confirmation message after the dialog closes.

## Interaction and accessibility
- Retain the shared dialog primitive for focus trapping, Escape/backdrop close, initial focus, and focus restoration.
- Keep native radio semantics for opening selection, accessible labels, keyboard selection, and Enter-to-confirm only when the form is valid.
- Use the existing button, badge, and menu primitives while locally applying the ink-only dialog treatment.

## Technical details
- Primary file: `src/components/candidates/MarkHiredDialog.tsx`.
- If needed for display-only deal metadata, extend the existing opening query to expose fields already present in `job_openings_with_status`; the hire request remains byte-for-byte equivalent.
- Use existing Poppins, Inter, and JetBrains Mono font setup and semantic design tokens; add dialog-specific semantic tokens only if existing tokens cannot represent the supplied palette.
- Validate with the project typecheck/build signal and inspect the dialog in the preview where authenticated access permits.

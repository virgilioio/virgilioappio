# Gio Fit output language

## Goal
Add workspace-default and candidate-specific output language controls for Gio Fit while guaranteeing that changing language cannot change the stored score, dimension scores, weights, confidence, or evidence selection.

## Data and settings
- Store the workspace default as an ISO 639-1 code inside the existing `tenants.settings` object, defaulting to English when absent.
- Add association fields for the optional language override, the language used by the current dossier, source-language provenance, and the “keep names and titles in source language” preference (default on).
- Keep the existing association access rules; validate supported language codes server-side and in the database.
- Add a Recruiting settings screen where workspace owners/admins choose the default Gio Fit language.

## Generation safety
- Extend `analyze-candidate-fit` to resolve language in this order: explicit association override, workspace default, English.
- Preserve the current English scoring prompt and all numeric post-processing unchanged.
- Generate the scored analysis first, then translate only human-readable text fields in a second structured pass when the requested language is not English.
- Copy all scores, weights, confidence values, dimension ordering, source keys, and priority values from the canonical result after translation, so language cannot alter them.
- Detect source language per provided source and persist provenance for display; preserve names and role/company titles when the preference is enabled.
- Keep automated generation callers compatible by resolving defaults inside the edge function.

## Dossier controls
- Replace the placeholder language chip with a working popover in the masthead action row.
- Show the current output language, workspace-default inheritance or association override, detected source-language badges, and the names/titles switch.
- Changing the language or preservation preference regenerates the dossier through the existing refresh flow and clearly shows progress/errors.
- Keep the existing Internal/Client-ready behavior unchanged.

## Verification
- Test English and a second language against the same association and confirm all numeric scoring fields remain byte-for-byte unchanged.
- Verify workspace default persistence, per-association override/reset, automated-generation fallback, provenance display, and responsive controls.
- Deploy and test `analyze-candidate-fit`; run type checks and confirm the preview build is clean.

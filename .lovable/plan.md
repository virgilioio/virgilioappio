## Fix: placeholder pills bleeding out of Subject / Message boxes in Reject Candidate modal

**Scope:** UI only. No changes to data, mutations, template loading, placeholder serialization, or send/schedule logic.

### Root cause

The Reject Candidate modal wraps `SubjectTemplateEditor` and `BodyTemplateEditor` in bespoke chrome (custom 38px input container for Subject; custom border + hand-rolled toolbar for Message). But both editors already render their own border/shadow/toolbar. Result: two stacked chromes, so the content line box is taller than the outer shell and the purple placeholder pill (padding 3/10, radius 12, font-size 0.875em, no fixed line-height) visibly extends past the outer border.

The healthy reference is `EmailComposer.tsx` (subject at 978, body at 990) which uses the editors bare — no outer wrapper, no duplicate toolbar.

### Changes

**1. `src/components/editors/lexicalTheme.ts` — harden the badge itself (benefits every consumer)**

In `.lexical-placeholder-badge` inside `LEXICAL_EDITOR_STYLES`:
- Add `line-height: 1;`
- Reduce `padding` from `3px 10px` to `2px 8px`
- Reduce `border-radius` from `12px` to `6px` (matches the Gio pill radius on small chips)
- Add `max-width: 100%` and keep `white-space: nowrap` with `text-overflow: ellipsis; overflow: hidden;` so a long placeholder inside a narrow Subject collapses gracefully instead of pushing width.
- Set `vertical-align: middle` (not baseline) so the pill centers in the line box of both the single-line subject input and the multi-line body.
- Add a tightened variant selector `.lexical-subject-editor .lexical-placeholder-badge { font-size: 12px; padding: 1px 7px; }` so the pill fits cleanly inside the 38px subject shell.

**2. `src/components/candidates/RejectionDialog.tsx` — align chrome with the standard composer**

Subject block (~lines 513-521):
- Remove the outer 38px styled container idea entirely and just render `<SubjectTemplateEditor …>` directly, exactly as `EmailComposer.tsx:978` does. Keep the `FieldLabel` above it.

Message block (~lines 523-545):
- Delete the outer `<div style={{ border, borderRadius, overflow: 'hidden' }}>` wrapper.
- Delete the hand-rolled toolbar row (lines 527-537) with `ToolbarGlyph` Bold/Italic/Underline/List/ListOrdered — those buttons are decorative today; `BodyTemplateEditor` already renders a real, wired toolbar.
- Render `<BodyTemplateEditor value={bodyHtml} onChange={setBodyHtml} placeholder="Write your rejection email…" minHeight="124px" />` directly. Do **not** pass `hideToolbar` — we want the real toolbar (matches EmailComposer).
- If any of the imported icons (`Bold, Italic, Underline, List, ListOrdered`) become unused after removing the fake toolbar, drop them from the import list. Do not touch `ToolbarGlyph` if it's used elsewhere in the file; only remove if it becomes unreferenced.

**3. Nothing else changes.**
- Keep `subjectHtml` / `bodyHtml` state, `convertHtmlToPlaceholders` usage, template application, `sendOption` scheduling, mutations, "recently used reason" chips, all copy, and the modal frame exactly as they are.
- Do not touch `EmailComposer.tsx`, `MinimizableEmailComposer.tsx`, `RejectionEmailComposer.tsx`, `SubjectTemplateEditor.tsx`, `BodyTemplateEditor.tsx`, or `PlaceholderNode.tsx`.

### Verification

- Open the Reject Candidate modal from an in-job candidate profile.
- Pick a template that contains `{{candidate_first_name}}` in both subject and body.
- Subject: pill sits inside the 38px input with clean top/bottom padding, no clipping when the field scrolls horizontally.
- Message: single border, single (real) toolbar, pills inline with body text, no seam/bleed.
- Confirm the Gio brand template chip, "recently used" reason chips, schedule preset row, and mutation buttons are unaffected.
- Confirm placeholders still serialize back to `{{key}}` on send (unchanged — same editors, same OnChange path).

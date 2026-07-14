## Fix Lexical overlay placeholder positioning (Subject + Message hint text)

**Scope:** CSS only, one file. No component/logic changes.

### Problem

The injected `.lexical-editor-placeholder` rule in `src/components/editors/lexicalTheme.ts` hard-codes `position: absolute; top: 0; left: 0;`. That style is appended to `<head>` at runtime and wins the cascade over the Tailwind classes each editor already sets on the same element (`left-3 top-1/2 -translate-y-1/2` for Subject; `left-3 top-3` for Message). Result: hint text renders at the top-left corner of the editor's relative wrapper instead of centered (Subject) or padded-aligned (Message). In the Reject modal that reads as the Subject placeholder floating **above** the input box.

### Change

In `src/components/editors/lexicalTheme.ts`, inside the `LEXICAL_EDITOR_STYLES` template string, update the `.lexical-editor-placeholder` block:

- Remove `top: 0;` and `left: 0;` — let each editor own positioning via Tailwind.
- Keep `position: absolute;` (needed so Tailwind's `top-*`/`left-*` engage) and `color: hsl(var(--muted-foreground));`, `pointer-events: none;`.
- Drop `overflow: hidden; text-overflow: ellipsis; white-space: nowrap;` from the shared rule — those make sense only for the single-line Subject.
- Add a Subject-scoped variant that restores single-line ellipsis: `.lexical-subject-editor + div .lexical-editor-placeholder, .lexical-subject-editor ~ .lexical-editor-placeholder { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }` — or, more robustly, scope by adding the ellipsis rules under the existing `.lexical-subject-editor .lexical-editor-placeholder` descendant if the placeholder ends up nested (verify actual DOM during implementation; if PlainTextPlugin renders the placeholder as a sibling, use the sibling selector form).

Net effect:
- Subject placeholder gets vertically centered (`top-1/2 -translate-y-1/2`) inside the 32px input, sitting cleanly on the baseline like the reference composer.
- Message placeholder aligns with the first text line (`top-3 left-3`), matching the ContentEditable's `p-3` padding.
- Long subject placeholders still ellipsize; body placeholders can wrap normally.

### Verification

1. Open Reject Candidate modal on an in-job candidate profile.
2. With "No template" selected, confirm:
   - "Update on your application" sits inside the Subject input, vertically centered.
   - "Write your rejection email…" sits at the top-left inside the Message box, aligned with where typed text would begin.
3. Open a normal "New email" composer elsewhere and confirm no regression in the legacy embedded form.
4. Pick a template that fills Subject and Message → confirm the overlay placeholders disappear (they should — Lexical hides them when content is present).

### Non-goals

- Not restyling the Reject modal to match the "New email" (screenshot 2) rich composer layout. That's a separate, larger redesign; happy to plan it if you want, but this fix is purely about the misrendering you flagged.
- No changes to `RejectionDialog.tsx`, `SubjectTemplateEditor.tsx`, `BodyTemplateEditor.tsx`, or `EmailComposer.tsx`.
- No changes to the placeholder-badge (purple pill) CSS I touched in the previous turn — that fix stands.

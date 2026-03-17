
Goal: fix the WhatsApp template editor so normal typing no longer teleports the caret to the beginning, while keeping placeholder badges and plain-text WhatsApp output working.

What’s causing it
- In `src/components/settings/WhatsAppIntegrationDetail.tsx`, every keystroke updates `templateText`.
- A `useEffect` then re-syncs `templateText` back into the `contentEditable` via `innerHTML = convertPlaceholdersToHtml(templateText)`.
- Replacing `innerHTML` recreates the DOM and resets the browser selection, which is why the cursor jumps to the start.

Implementation plan

1. Make the WhatsApp editor follow the same “do not re-sync while focused” pattern already used in `src/components/ui/placeholder-input.tsx`
- Add focus/update guards (`isFocusedRef`, `isUpdatingRef`) to `WhatsAppIntegrationDetail`.
- Only push external state into `editorRef.current.innerHTML` when:
  - the editor is not focused, or
  - the value came from initial load / save / remote refresh.
- This removes the per-keystroke DOM rewrite that is breaking the caret.

2. Keep DOM changes minimal during typing
- `handleInput` should keep converting current editor HTML into clean plain text for state/storage.
- It should only rebuild badge HTML when the user has actually typed a raw `{{placeholder}}` token or pasted content that needs badge conversion.
- For normal typing, do not touch `innerHTML`; only update `templateText`.

3. Preserve cursor correctly when a raw placeholder is transformed into a badge
- Before converting typed `{{...}}` into badge HTML, capture the current selection.
- After the DOM rewrite, restore the cursor immediately after the inserted badge/space, not at the start or end of the whole editor.
- Keep the existing explicit insertion flow for placeholder chips, but align it with the same guarded update logic.

4. Centralize sanitization to avoid editor/output drift
- Reuse `stripHtmlToPlainText` from `src/utils/templateUtils.ts` inside the WhatsApp editor input pipeline instead of maintaining a separate inline sanitizer.
- This keeps the editor, saved template, and final sent message on the same plain-text rules.

Files to update
- `src/components/settings/WhatsAppIntegrationDetail.tsx`
  - Add focus/update guards
  - Stop unconditional `innerHTML` re-sync during typing
  - Limit DOM rewrites to true placeholder conversions
  - Restore selection after badge conversion
  - Reuse shared HTML-to-plain-text sanitization
- `src/utils/templateUtils.ts`
  - Possibly make the sanitizer slightly more reusable/export-friendly if needed, but no behavior change unless required for the editor pipeline

Expected result
- Typing anywhere in the WhatsApp template keeps the caret in place
- Placeholder chips still insert correctly
- Backspace/Delete near badges still works without deleting random content
- Pasted/rich-text content is normalized to plain text
- Final WhatsApp message remains free of raw HTML tags/entities

Regression checks after implementation
- Type in the beginning, middle, and end of an existing template
- Insert a placeholder chip between words and continue typing
- Backspace a normal character next to a badge without deleting the badge
- Delete a badge only when the caret is actually at its boundary
- Paste multiline plain text and formatted text from another source
- Save, reload settings, and verify the editor content stays stable
- Trigger the first-click WhatsApp flow and confirm the sent message is plain text only

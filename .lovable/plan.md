## Problem
In `EmailComposer`, `insertBookingLinkIntoBody` builds a snippet string and appends it to the end of `bodyHtml`:

```ts
const next = (bodyHtml || '') + snippet;
setBodyHtml(next);
```

The Lexical `BodyTemplateEditor` then re-loads that HTML, so the booking card always lands at the bottom regardless of where the cursor is. Subject-line placeholder insertion works correctly because it goes through `bodyEditorRef.current?.insertPlaceholder(...)`, which uses the live Lexical selection.

## Fix (small, presentation-only)

1. **Extend `BodyTemplateEditorHandle`** in `src/components/editors/BodyTemplateEditor.tsx` with a new imperative method:
   - `insertHtml(html: string): void`
   
   Implementation inside `useImperativeHandle`:
   - `editor.focus()` first so a valid selection exists if the editor was blurred.
   - `editor.update(() => { ... })`:
     - Parse the incoming HTML with `$generateNodesFromDOM` from `@lexical/html` (using `new DOMParser().parseFromString(html, 'text/html')`).
     - Get the current selection via `$getSelection()`. If it's a `RangeSelection`, call `selection.insertNodes(nodes)` — this places the booking card exactly where the cursor is.
     - Fallback (no/invalid selection): append the parsed nodes as children of `$getRoot()` so behavior degrades to today's "append" instead of crashing.
   - The existing `OnChangePlugin` will fire and propagate the new HTML up through `onChange`, keeping `bodyHtml` and RHF `body_html` in sync — no manual `setBodyHtml` needed.

2. **Update `insertBookingLinkIntoBody`** in `src/components/candidates/EmailComposer.tsx` (lines 222-229):
   - Keep the snippet building (same `<p><a>…</a><br/><span>…</span></p><p><br/></p>` markup, same `safeUrl` escaping, same `payload.title || payload.url` label).
   - Replace the string concat + `setBodyHtml` + `setValue` calls with a single `bodyEditorRef.current?.insertHtml(snippet)`.
   - Drop the `bodyHtml` dependency from `useCallback` since we no longer read it.

3. **No other changes.** The `BookingLinkPopover` wiring, the calendar `FooterIcon`, the payload shape, and the bulk-composer branch (lines 978-994, which uses a separate `BodyTemplateEditor` without a ref) all stay as-is. If we want the same UX for bulk later, we can add a ref there in a follow-up — but the user's report is about the standard composer.

## Technical notes

- `@lexical/html`'s `$generateNodesFromDOM(editor, dom)` is already the standard pattern used elsewhere in this codebase's Lexical editors (see `loadHtmlIntoEditor` in `placeholderLexicalUtils`). We reuse it so the booking card renders with the same paragraph/link node structure as user-typed content, and `PlaceholderNode` handling is unaffected because the snippet contains no placeholders.
- Because `OnChangePlugin` calls back into `onChange` → `setBodyHtml`, we avoid the "external value changed while focused" path in `BodyEditorInner` (it early-returns when `isFocused` is true), so the cursor-position insert isn't clobbered by a reload.
- The AI "Make warmer" effect keys off `bodyHtml`; since we still update `bodyHtml` via `OnChangePlugin`, that effect keeps working identically.

## Verification
- Type "Hi {{first_name}}, please pick a time: |CURSOR| — talk soon.", click the calendar icon, pick a booking link → the card appears at `|CURSOR|`, not at the end.
- Insert with cursor at the very start of the body → card appears at the top.
- Insert into an empty body → card appears as the only content.
- Existing behaviors unchanged: sending, placeholder chips in subject/body, AI rewrite suggestion, discard, attachments, ⌘↵ send.

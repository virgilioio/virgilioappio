
# Fix WhatsApp Template Editor: Cursor-Position Insert + Badge Rendering

## Problems
1. **Placeholders always append to end** — clicking a placeholder button does `prev + placeholder` instead of inserting at cursor position in the textarea.
2. **No badge rendering** — uses a plain `<Textarea>` which cannot render visual placeholder badges.

## Approach

Replace the plain `<Textarea>` with a `contentEditable` div that renders placeholder badges visually (reusing the existing `placeholder-badge` CSS and `convertPlaceholdersToHtml`/`convertHtmlToPlaceholders` utilities). This is the same pattern used in `SubjectInputWithBadges` and `rich-text-editor`, but adapted for multi-line plain-text output.

## Changes

### `src/components/settings/WhatsAppIntegrationDetail.tsx`

1. **Add a ref** for the contentEditable div and track cursor position.
2. **Replace `<Textarea>`** with a `contentEditable` div styled like the existing textarea (min-height, border, padding, placeholder text via `:empty:before`).
3. **Render content** using `convertPlaceholdersToHtml(templateText)` so `{{placeholder}}` tokens display as purple pill badges.
4. **On input**, convert HTML back to plain text with `convertHtmlToPlaceholders`.
5. **Placeholder button click**: Instead of appending, use `document.execCommand('insertHTML', ...)` or manual DOM range insertion to insert the badge HTML at the current cursor position inside the contentEditable div. If no cursor position exists (div not focused), fall back to appending.
6. **Inject placeholder-badge styles** on mount (reuse the existing style injection pattern from `rich-text-editor.tsx`).
7. **Handle paste** — strip HTML, insert plain text only (WhatsApp messages are plain text).
8. **Handle keydown** — protect badges from partial deletion (same pattern as `SubjectInputWithBadges`).

The stored value (`templateText` / `automation.body`) remains plain text with `{{placeholder}}` syntax — only the visual rendering uses badges. This ensures compatibility with the WhatsApp wa.me link generation which expects plain text.

### No other files need changes
The badge CSS is already globally available via the style injection in `rich-text-editor.tsx`, and the conversion utilities exist in `placeholderUtils.ts`.

| File | Change |
|------|--------|
| `src/components/settings/WhatsAppIntegrationDetail.tsx` | Replace Textarea with contentEditable div + cursor-aware placeholder insertion + badge rendering |

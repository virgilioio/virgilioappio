Fix text overflow in the email body editor (`BodyTemplateEditor`) so long content stays contained and scrolls internally.

### Problem
The Lexical `ContentEditable` area in `BodyTemplateEditor.tsx` only sets `minHeight` (e.g. `150px`) with no `maxHeight` or `overflow` control. When a user types a long email, the text bleeds out of the intended text box boundaries instead of staying contained with an internal scrollbar.

### Changes

**File: `src/components/editors/BodyTemplateEditor.tsx`**
- Add an optional `maxHeight` prop to the component (default: `400px`).
- Apply `overflow-y: auto` to the `ContentEditable` wrapper so content scrolls internally once it exceeds `maxHeight`.
- Apply `overflow-wrap: break-word` / `break-words` to the `ContentEditable` className so long unbroken strings (e.g. URLs) wrap instead of overflowing horizontally.
- Ensure the existing `minHeight` behavior is preserved.

### Verification
- Run TypeScript check (`bunx tsgo --noEmit`) to confirm no type regressions.
- Visually verify in the Rejection Email composer that typing/pasting a long body keeps text inside the box and shows a vertical scrollbar.
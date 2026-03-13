

# Fix: Template Body Saved as Raw HTML on Reload

## Root Cause

The `OnChangePlugin` correctly serializes the Lexical editor state as HTML (`<p><strong>Hi</strong>...</p>`). This HTML is stored in the database — that's fine.

The bug is on **load**: `BodyTemplateEditor` calls `convertHtmlToPlaceholders(value)` which only strips placeholder badge spans, leaving `<p>`, `<strong>`, `<em>` etc. intact as literal text. Then it splits by `\n` (HTML has no newlines) and feeds the entire HTML string as one line to `parseTemplateToNodes`, which treats the tags as literal text content. Result: users see raw HTML.

## Fix

**File: `src/components/editors/BodyTemplateEditor.tsx`**

In both initialization `useEffect` blocks (lines 130-149 and 152-171):
- Detect whether `value` contains HTML tags (`/<\/?[a-z][\s\S]*>/i`)
- If HTML: use the existing `loadHtmlIntoEditor(editor, value)` from `placeholderLexicalUtils.ts` — this properly parses HTML via DOMParser, converts `$generateNodesFromDOM`, and handles placeholder conversion
- If plain text: keep existing logic (split by `\n`, `parseTemplateToNodes`)

Import `loadHtmlIntoEditor` from `./utils/placeholderLexicalUtils`.

~10 lines changed total. No database or other file changes needed.


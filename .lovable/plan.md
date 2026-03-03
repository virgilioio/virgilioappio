

# Fix: HTML Entities Displayed as Raw Text in Email History

## Problem

In `EmailHistoryCard.tsx`, the collapsed email preview strips HTML tags with a regex (`replace(/<[^>]*>/g, '')`) but does **not** decode HTML entities like `&#39;`, `&amp;`, `&quot;`, etc. This results in raw entity strings like `&#39;ve` showing instead of `'ve`.

The same issue can affect `body_text` content if it contains encoded entities, and also the `snippet` field.

## Fix

**File:** `src/components/candidates/EmailHistoryCard.tsx`

Add a helper function that decodes HTML entities by using the browser's built-in HTML parser (textarea element), then use it when generating the plain-text preview.

```typescript
function decodeHtmlEntities(text: string): string {
  const textarea = document.createElement('textarea');
  textarea.innerHTML = text;
  return textarea.value;
}
```

Apply it in two places around line 181-183:

1. The collapsed preview: wrap the result of `body_html?.replace(/<[^>]*>/g, '').slice(0, 150)` with `decodeHtmlEntities()`
2. The `body_text` preview: wrap `body_text?.slice(0, 150)` with `decodeHtmlEntities()` as well

The expanded view uses `SafeHtml` which already handles this correctly via `dangerouslySetInnerHTML`.


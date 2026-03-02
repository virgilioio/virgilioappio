

# Fix Links Not Working in Email Composer and Email History

## Root Cause

There are **three interconnected issues** preventing links from working:

### 1. Editor doesn't auto-detect URLs (Composer)
The `BodyTemplateEditor` registers `LinkNode` and `AutoLinkNode` in its node list, and includes `LinkPlugin`, but there is **no `AutoLinkPlugin`** from `@lexical/react`. Without it, Lexical never auto-detects pasted/typed URLs and converts them to `LinkNode`. So URLs remain as plain `TextNode` — they look and behave like regular text.

### 2. OnChangePlugin discards link information (Composer output)
The `OnChangePlugin` serializes the editor state by walking nodes and only handling `PlaceholderNode` and `TextNode`. It calls `node.getTextContent()` on everything else — including `LinkNode`. So even if a link were somehow created, it would be serialized as plain text (e.g., `https://example.com`) without any `<a>` tag wrapping. The `body_html` sent to the backend is effectively plain text with newlines, not real HTML.

### 3. Email history shows raw HTML without linkifying plain URLs (History view)
The `EmailHistoryCard` renders `body_html` via `SafeHtml`. While `SafeHtml` allows `<a>` tags, the stored `body_html` contains raw URL text (not wrapped in `<a>` tags) because the composer never created them. There's no URL auto-linkification at display time either.

## Fix Plan

### Change 1: Add AutoLinkPlugin to BodyTemplateEditor
**File:** `src/components/editors/plugins/AutoLinkPlugin.tsx` (new file)

Create a Lexical `AutoLinkPlugin` that detects URL patterns (http/https) and automatically converts them to `LinkNode` as the user types or pastes. This uses `@lexical/react/LexicalAutoLinkPlugin` which is already available since `@lexical/react` is installed.

```typescript
import { AutoLinkPlugin as LexicalAutoLinkPlugin } from '@lexical/react/LexicalAutoLinkPlugin';

const URL_MATCHER = /((https?:\/\/(www\.)?)|(www\.))[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_+.~#?&//=]*)/;

const MATCHERS = [
  (text: string) => {
    const match = URL_MATCHER.exec(text);
    if (match === null) return null;
    const fullMatch = match[0];
    return {
      index: match.index,
      length: fullMatch.length,
      text: fullMatch,
      url: fullMatch.startsWith('http') ? fullMatch : `https://${fullMatch}`,
    };
  },
];

export function AutoLinkPlugin() {
  return <LexicalAutoLinkPlugin matchers={MATCHERS} />;
}
```

Then add `<AutoLinkPlugin />` inside `BodyEditorInner` alongside the existing `<LinkPlugin />`.

### Change 2: Update OnChangePlugin to serialize LinkNodes as `<a>` tags
**File:** `src/components/editors/plugins/OnChangePlugin.tsx`

Import `LinkNode` and `$isLinkNode` from `@lexical/link`. When walking child nodes, check for `LinkNode` and output `<a href="...">text</a>` instead of just the text content. This ensures the `body_html` sent to the backend contains proper clickable links.

Updated serialization logic:
```typescript
import { LinkNode, $isLinkNode } from '@lexical/link';

// Inside the node walker:
if ($isPlaceholderNode(node)) {
  paragraphContent += `{{${node.getPlaceholderKey()}}}`;
} else if ($isLinkNode(node)) {
  const url = node.getURL();
  const linkText = node.getTextContent();
  paragraphContent += `<a href="${url}" target="_blank" rel="noopener noreferrer">${linkText}</a>`;
} else if (node instanceof TextNode) {
  // Handle bold/italic/underline formatting
  let text = node.getTextContent();
  if (node.hasFormat('bold')) text = `<strong>${text}</strong>`;
  if (node.hasFormat('italic')) text = `<em>${text}</em>`;
  if (node.hasFormat('underline')) text = `<u>${text}</u>`;
  paragraphContent += text;
} else {
  paragraphContent += node.getTextContent();
}
```

Also wrap paragraph output in `<p>` tags so the body is proper HTML (not just plain text with newlines). This is needed for correct rendering in email clients anyway.

### Change 3: Auto-linkify URLs in email history display
**File:** `src/components/ui/safe-html.tsx`

Add a `linkifyUrls` post-processing step after sanitization. This converts any plain-text URLs that aren't already inside `<a>` tags into clickable links. This fixes both:
- Historical emails that were sent before this fix
- Received emails from external senders that might have plain-text URLs

```typescript
function linkifyUrls(html: string): string {
  // Don't linkify URLs that are already inside <a> tags
  const urlRegex = /(?<!href=["']|>)(https?:\/\/[^\s<]+)/g;
  // Use DOM parsing to only linkify text nodes, not attributes
  const div = document.createElement('div');
  div.innerHTML = html;
  // Walk text nodes and replace URLs
  // ... (implementation using TreeWalker for safety)
  return div.innerHTML;
}
```

### Change 4: Ensure links open in new tab in SafeHtml
**File:** `src/utils/htmlSanitizer.ts`

Add `target="_blank"` and `rel="noopener noreferrer"` to all `<a>` tags during sanitization so links always open in a new tab (important since the app runs in an iframe).

The sanitizer already allows `target` and `rel` attributes (line 19), so we just need a post-processing step to add them to any `<a>` tags that don't have them.

## Files to modify

| File | Action |
|------|--------|
| `src/components/editors/plugins/AutoLinkPlugin.tsx` | **Create** - Lexical auto-link detection plugin |
| `src/components/editors/BodyTemplateEditor.tsx` | **Edit** - Add AutoLinkPlugin import and usage |
| `src/components/editors/plugins/OnChangePlugin.tsx` | **Edit** - Serialize LinkNodes as `<a>` tags, wrap paragraphs in `<p>` tags, handle text formatting |
| `src/components/ui/safe-html.tsx` | **Edit** - Add URL auto-linkification for display |
| `src/utils/htmlSanitizer.ts` | **Edit** - Ensure `<a>` tags get `target="_blank"` |

## Impact

- URLs pasted/typed in the email composer will auto-become clickable links in the editor
- Sent emails will contain proper `<a href>` tags in the HTML body
- Email history will show all URLs (old and new) as clickable links
- Links open in a new tab to avoid navigating away from the app
- No breaking changes to templates or placeholder handling


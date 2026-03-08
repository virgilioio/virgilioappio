

# Fix Bullet Point Formatting on Public Job Postings

## Problem
Job descriptions are stored with bullet characters (`•`) inside individual `<p>` tags instead of proper `<ul><li>` HTML:

```html
<!-- What's stored -->
<p>• Write persuasive email copy</p>
<p>• Support A/B testing</p>

<!-- What should render -->
<ul>
  <li>Write persuasive email copy</li>
  <li>Support A/B testing</li>
</ul>
```

This happens because content is pasted from external sources (Google Docs, Word) where bullets become `•` characters. The RichTextEditor preserves the raw paste, and `SafeHtml` renders them as flat paragraphs with no indentation or bullet styling.

9 out of 12 postings contain `•` characters, so this is a widespread issue.

## Fix

### `src/utils/htmlSanitizer.ts`
Add a **post-sanitization** transform function that converts consecutive `<p>` tags starting with `•`, `–`, or `-` into proper `<ul><li>` lists:

- Parse the sanitized HTML into a temporary DOM
- Walk through `<p>` elements; when a run of consecutive `<p>` tags all start with a bullet character (`•`, `–`, `- `), group them into a `<ul>` with `<li>` children (stripping the leading bullet character)
- Replace the original `<p>` run with the generated `<ul>`
- Return the cleaned HTML

This runs inside `sanitizeHtml()` after DOMPurify and `normalizeTypography`, so it fixes all existing content everywhere `SafeHtml` is used (public postings, tenant about, email previews, etc.) without needing to touch individual components or migrate stored data.

### No other file changes needed
`SafeHtml` already allows `<ul>` and `<li>` tags, and the `prose` class on the public page already styles lists correctly. The fix is purely in the sanitizer pipeline.


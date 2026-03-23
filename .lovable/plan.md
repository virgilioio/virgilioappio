

# Fix Application Confirmation Email Showing Raw HTML Tags

## Problem

The BodyTemplateEditor saves email body as HTML (`<p>Hi {{candidate.first_name}},</p><p>Thank you...</p>`). But in `public-submit-application/index.ts` lines 785-790, the code treats this as plain text and escapes the HTML:

```js
const bodyHtml = resolvedBody
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')   // ← turns <p> into &lt;p&gt;
  .replace(/>/g, '&gt;')
  .replace(/\n/g, '<br>');
```

This turns `<p>Hi John,</p>` into `&lt;p&gt;Hi John,&lt;/p&gt;` — so the recipient sees literal `<p>` tags in their email.

The `send-user-email` edge function already has a `textToHtml()` function that detects existing `<p>` tags and passes them through unchanged. So the conversion in `public-submit-application` is both wrong and redundant.

## Fix

**`supabase/functions/public-submit-application/index.ts`**

Remove the HTML-escaping block (lines 785-790). Send `resolvedBody` directly as `body_html` — the `send-user-email` function's `textToHtml()` will handle it correctly whether it's HTML or plain text.

```ts
// Before (wrong):
const bodyHtml = resolvedBody
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/\n/g, '<br>');

// After (correct):
// send-user-email's textToHtml() already handles both HTML and plain text
const bodyHtml = resolvedBody;
```

Then redeploy the `public-submit-application` edge function.

## Files

| File | Change |
|------|--------|
| `supabase/functions/public-submit-application/index.ts` | Remove HTML-escaping of already-HTML body content |


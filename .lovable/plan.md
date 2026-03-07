

# Fix: `resumeText.trim is not a function`

## Problem

`unpdf`'s `extractText()` returns `{ text }` where `text` is an **array of strings** (one per page), not a single string. The code treats it as a string, so every `.trim()` call crashes.

## Fix

**File**: `supabase/functions/batch-re-enrich/index.ts`

In `extractTextFromPdf`, coerce the result to a string:

```typescript
async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
  try {
    const { text } = await extractText(pdfBytes);
    // unpdf returns text as string[] (per page) or string — normalize
    const result = Array.isArray(text) ? text.join('\n') : (text || '');
    return typeof result === 'string' ? result : String(result);
  } catch (err) {
    console.error('[batch-re-enrich] unpdf extraction error:', err);
    return '';
  }
}
```

One line change, then redeploy.

| File | Change |
|---|---|
| `supabase/functions/batch-re-enrich/index.ts` | Normalize `extractText` result from array to string |


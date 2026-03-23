

# Fix Polish Notes to Work with Both Manual and AI-Generated Notes

## Problem

The `polish-scorecard-notes` edge function receives `currentNotes` as raw HTML from the rich text editor. This works adequately for simple manual notes (e.g., `<p>Good candidate</p>`), but when the notes contain AI-generated content from the ingest system (applied via "Apply Suggestion"), the HTML is heavily formatted with `<h2>`, `<strong>`, `<ul>`, `<li>`, etc. This raw HTML:

1. Wastes tokens sent to OpenAI
2. Can confuse the model's language detection (HTML tags look like English)
3. Makes the "raw notes" section of the prompt harder for the model to parse

The same issue exists for `jobDescription` — it's HTML from the rich text editor but isn't stripped before being sent to the AI.

## Fix

**`supabase/functions/polish-scorecard-notes/index.ts`**

Add an HTML-stripping helper at the top and apply it to both `currentNotes` and `jobDescription` before inserting them into the prompt:

```ts
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
```

Then in the prompt construction:
- `currentNotes` → `stripHtml(currentNotes)`
- `jobDescription` → `stripHtml(jobDescription)`

This ensures the AI always receives clean plain text regardless of whether the notes are manual or AI-generated from the ingest system.

## Files

| File | Change |
|------|--------|
| `supabase/functions/polish-scorecard-notes/index.ts` | Add `stripHtml` helper; strip HTML from `currentNotes` and `jobDescription` before prompt insertion |


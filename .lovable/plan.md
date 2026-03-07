

# Critical Bug: Batch Enrichment Produces Hallucinated Profiles

## Root Cause (Confirmed)

The `batch-re-enrich` edge function has a **completely broken PDF text extractor**. The logs prove it:

1. `pdf-parse@1.1.1` via `esm.sh` **always fails** in Deno with: `fs.readFileSync is not implemented yet!`
2. The fallback extracts raw binary data between PDF `stream`/`endstream` markers -- this is compressed gibberish, not readable text
3. Despite being garbage, it passes the `length < 50` check (it's 15,000 chars of binary noise)
4. The AI receives the candidate's name + 14KB of gibberish, and **hallucinates an entirely fabricated profile**

This is why every candidate gets nearly identical summaries ("sólida trayectoria en el ámbito de la ingeniería y la gestión de proyectos") and fake company names ("Tecnologías Avanzadas S.A.", "Tech Solutions Inc.", "Innovatech").

There is **no data bleeding between candidates** -- each is processed individually. The problem is that **none of them receive real resume text**, so the AI invents generic profiles based only on the name.

## Evidence

- Logs show `PDF parse error, trying fallback` for **every single candidate**
- All affected candidates show exactly `15000 chars` extracted (the garbage cap)
- Candidates with 56K+ chars extracted (Karla Treviño, Diego Ancira) likely had simpler PDFs where the fallback accidentally worked
- Work experience contains fabricated companies not from any real resume

## Fix

**File**: `supabase/functions/batch-re-enrich/index.ts`

Replace the broken `extractTextFromPdf` function. Instead of trying to parse PDFs locally (which doesn't work in Deno), delegate to the existing `parse-resume` edge function which already handles PDF text extraction correctly on the client side.

**Strategy**: The batch function already downloads the PDF and has the raw bytes. Instead of parsing locally, it should:

1. Call the existing `parse-resume` function with the text (for PDFs that were already extracted on upload) OR
2. Use a Deno-compatible PDF library (`pdf-lib` can read text, or use `unpdf`/`pdf2json` which work in Deno)
3. Add a **garbage detection check**: if the extracted text has a low ratio of alphanumeric characters to total characters, reject it as binary garbage

**Concrete changes**:

1. Replace `extractTextFromPdf` with `unpdf` (a Deno-native PDF text extractor):
```typescript
import { extractText } from "https://esm.sh/unpdf@0.12.1";

async function extractTextFromPdf(pdfBytes: Uint8Array): Promise<string> {
  const { text } = await extractText(pdfBytes);
  return text;
}
```

2. Add a garbage detection guard before sending to AI:
```typescript
function isReadableText(text: string): boolean {
  // Count alphanumeric + common punctuation vs total
  const readable = text.replace(/[^a-zA-Z0-9áéíóúñüÁÉÍÓÚÑÜ\s.,;:!?@\-()\/]/g, '');
  return readable.length / text.length > 0.5;
}
```
If the text fails this check, mark the candidate as `failed` with error `"PDF text extraction produced unreadable content"` instead of sending garbage to the AI.

3. Reset the affected candidates so they can be re-processed:
```sql
UPDATE candidates 
SET enrichment_status = 'pending', profile_summary = NULL, enriched_at = NULL
WHERE enriched_at >= '2026-03-07T05:38:00' 
  AND enriched_at <= '2026-03-07T05:40:00';

DELETE FROM candidate_work_experience 
WHERE candidate_id IN (SELECT id FROM candidates WHERE enriched_at IS NULL AND enrichment_status = 'pending');

DELETE FROM candidate_education 
WHERE candidate_id IN (SELECT id FROM candidates WHERE enriched_at IS NULL AND enrichment_status = 'pending');

DELETE FROM candidate_certifications 
WHERE candidate_id IN (SELECT id FROM candidates WHERE enriched_at IS NULL AND enrichment_status = 'pending');
```

| File | Change |
|---|---|
| `supabase/functions/batch-re-enrich/index.ts` | Replace broken `extractTextFromPdf` with `unpdf`, add garbage text detection guard |
| SQL migration | Reset hallucinated enrichment data for affected candidates |


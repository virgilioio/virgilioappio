

# Fix: AI Enrichment Not Properly Parsing PDFs from Storage

## Root Cause

When the "AI Enrich" button is clicked on the Independent Candidate Profile, the `triggerBackgroundEnrichment` function is called with an empty `resumeText` (`''`). The `enrich-candidate-profile` edge function then tries to fetch the resume from storage, but it reads the PDF file using `fileData.text()` — which returns binary garbage for PDFs.

The `batch-re-enrich` function does this correctly: it uses the `unpdf` library to extract readable text from PDFs and includes a `isReadableText` guard. But `enrich-candidate-profile` never got this fix.

## Fix

**File:** `supabase/functions/enrich-candidate-profile/index.ts` (lines ~457-476)

Replace the naive `fileData.text()` approach with proper PDF extraction:

1. Import `unpdf` (same as batch-re-enrich uses)
2. When the downloaded file is a PDF, convert to `Uint8Array` and use `extractText` from `unpdf`
3. Add the `isReadableText` guard to detect and reject binary noise
4. For DOCX files, add basic text extraction (same pattern as batch-re-enrich)
5. Only fall back to `.text()` for `.txt`/`.md` files

This is essentially porting the PDF extraction logic from `batch-re-enrich` (lines 257-282) into `enrich-candidate-profile`'s storage fallback path.

No other files need to change — the edge function just needs to be redeployed after the fix.


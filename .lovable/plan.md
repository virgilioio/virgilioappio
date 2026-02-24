

# Trigger AI Enrichment After Chrome Extension Resume Upload

## What This Does
After a resume is successfully uploaded via the Chrome extension, automatically trigger background AI enrichment to generate a profile summary and extract skills -- the same enrichment that already runs when candidates apply through the public form.

## Why
Currently, resumes uploaded via the Chrome extension are stored but never analyzed by AI. This means candidates added from LinkedIn with attached resumes don't get the AI-generated profile summary or skills that candidates from other channels receive.

## Implementation

### Single file change: `supabase/functions/chrome-api-gateway/index.ts`

After the success log on line 713, before the return statement, add:

1. **PDF text extraction** -- Use a lightweight `TextDecoder` + regex approach to pull readable text from the raw PDF bytes (already available as `fileBytes`). This works for most text-based PDFs (including LinkedIn-generated ones).

2. **Fire-and-forget enrichment call** -- If meaningful text is extracted (more than 50 characters), invoke `enrich-candidate-profile` via `supabase.functions.invoke()` with the candidate ID and extracted text. This call is non-blocking -- the extension gets its response immediately.

3. **Silent failure handling** -- If text extraction fails or yields too little text, we skip enrichment silently. No impact on the upload flow.

### Technical Detail

The PDF text extraction uses a simple approach:
- Decode PDF bytes to string via `TextDecoder`
- Extract text between PDF stream markers using regex
- Clean up whitespace and non-printable characters
- This avoids needing a full PDF parsing library in the edge function

The enrichment function (`enrich-candidate-profile`) returns 202 immediately and processes in the background using `EdgeRuntime.waitUntil()`, generating the AI profile summary and skills asynchronously.

### No other files change
The `enrich-candidate-profile` function already exists and handles everything from there.


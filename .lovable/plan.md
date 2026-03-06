

# Batch Re-Enrich Existing Candidates

## Problem
Existing candidates were enriched with the old logic, so their new fields (`current_job_title`, `seniority_level`, `functional_area`, work experience, education, certifications) are all null. The enrichment function needs `resumeText` which isn't stored in the DB -- it's extracted from PDFs at upload time and passed through.

## Solution
Create a one-time **`batch-re-enrich`** edge function that you invoke once (via Supabase dashboard or curl). No UI button needed.

### How it works
1. Query `candidates` joined with `candidate_attachments` (where `is_resume = true`) to find candidates that have a resume but are missing the new structured fields (e.g. `current_job_title IS NULL`).
2. For each candidate, download the resume PDF from Supabase Storage, extract text using a lightweight PDF text extraction approach (same as the existing `parse-resume` function uses).
3. Call the existing `enrich-candidate-profile` function for each candidate with the extracted text.
4. Process candidates sequentially with a small delay to avoid rate-limiting OpenAI.
5. Return a summary of how many candidates were queued.

### Edge Function: `supabase/functions/batch-re-enrich/index.ts`
- Accepts optional `limit` parameter (default 50) to control batch size
- Accepts optional `dry_run` parameter to preview which candidates would be re-enriched
- Uses service role key to read storage and candidate data
- Filters: `enrichment_status = 'complete' AND current_job_title IS NULL` (already enriched with old logic, missing new fields)
- Downloads PDF from storage bucket, extracts text, invokes `enrich-candidate-profile` for each

### Usage
After deployment, invoke once from Supabase dashboard or curl:
```bash
# Dry run first to see which candidates will be processed
curl -X POST .../batch-re-enrich -d '{"dry_run": true}'

# Then run for real
curl -X POST .../batch-re-enrich -d '{"limit": 50}'
```

### Config
- Add `verify_jwt = false` entry in `supabase/config.toml` (protected by service role check in code)
- No new secrets needed -- reuses existing `OPENAI_API_KEY` and Supabase service role


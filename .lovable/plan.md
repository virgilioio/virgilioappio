

# Resume Download & Storage During CSV Import

## Current Behavior

Right now, when you import candidates via CSV with a resume URL column, the system:
1. Stores the URL string in the `resume_url` field on the candidate record
2. The batch enrichment pipeline can later **fetch** the PDF from that URL, extract text, and run AI enrichment
3. But it does **not** download and permanently store the actual resume file

This means if the external URL goes dead (company takes down their file server, Google Drive link expires, etc.), **the resume is lost**.

## Proposed Fix

Add a step to the `batch-re-enrich` edge function so that after successfully downloading a resume from an external URL, it:

1. **Saves the PDF to Supabase Storage** (`candidate-attachments` bucket)
2. **Creates a `candidate_attachments` database record** (with `is_resume = true`)
3. **Then** proceeds with AI enrichment as before

This way, every resume referenced by URL in the CSV gets permanently stored in your system — just like a manually uploaded resume.

## Changes

| File | What |
|---|---|
| **Modified** | `supabase/functions/batch-re-enrich/index.ts` — After fetching an external URL, upload the file bytes to `candidate-attachments` storage, insert a `candidate_attachments` row, then continue with enrichment |

## Key Logic

```text
For each candidate with an external resume URL:
  1. Fetch the PDF from the URL
  2. Upload bytes → storage: candidate-attachments/{candidateId}/{timestamp}-resume.pdf
  3. Insert → candidate_attachments table (candidate_id, file_url, file_name, is_resume=true)
  4. Extract text → send to enrich-candidate-profile (existing flow)
```

This is a single edge function update. No frontend changes needed — the batch enrichment runner in Platform Settings already triggers this function. After running "Batch Enrich", all CSV-imported candidates with resume URLs will have their resumes downloaded, stored, and AI-parsed.


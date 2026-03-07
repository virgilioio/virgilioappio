

# CSV Candidate Import with Resume URL Support

## The Idea

Companies migrating to the ATS can upload a CSV file containing their candidate database. Each row has candidate info (name, email, phone, LinkedIn, location, etc.) and optionally a **URL to the resume file**. The system creates all candidates from the CSV data, then uses the existing batch enrichment pipeline to download and parse the resumes from those URLs in the background.

This is smart because:
- CSV parsing is instant (no AI cost, no file uploads)
- Resume downloading + AI enrichment happens asynchronously via the existing `batch-re-enrich` / `enrich-candidate-profile` pipeline
- No timeout issues — candidates are created first, enrichment runs in batches of 30

## How It Works

1. User uploads a CSV file in a new "CSV Import" dialog
2. Frontend parses the CSV client-side, shows a preview table + column mapping UI
3. User maps CSV columns to candidate fields (name, email, phone, LinkedIn, location, resume URL)
4. System creates candidates in batches (direct DB inserts via existing `addCandidate`)
5. For rows with a resume URL, store it on the candidate record and mark `enrichment_status = 'pending'`
6. After import, user can trigger "Batch Enrich All" (already built) to process all resume URLs

## Column Mapping

The UI will auto-detect common column names (Name, Email, Phone, LinkedIn, Resume, Location) and let users manually adjust mappings via dropdowns. Unmapped columns are ignored.

## Changes

| Action | File | What |
|---|---|---|
| **New** | `src/components/candidates/CSVImportDialog.tsx` | Main dialog: file upload, preview, column mapping, progress |
| **New** | `src/lib/csvParser.ts` | Client-side CSV parsing utility (handles quotes, commas in values, encoding) |
| **New** | `src/hooks/useCSVCandidateImport.ts` | Hook: batch-creates candidates from parsed CSV rows, handles duplicates, tracks progress |
| **Modified** | `src/components/candidates/MinimizableBulkUploadDialog.tsx` or candidate list header | Add "Import CSV" button to trigger the dialog |
| **Modified** | `supabase/functions/batch-re-enrich/index.ts` | Support candidates with `resume_url` (external URL) but no stored attachment — download from URL, extract text, enrich |
| **Fix** | `src/components/settings/PlatformSettingsManager.tsx` | Change `grid-cols-5` to `grid-cols-6` so Enrichment tab is visible |

## CSV Import Flow

```text
┌─────────────────────────────────────┐
│  1. Upload CSV                      │
│  ┌───────────────────────────────┐  │
│  │  Drop CSV file here           │  │
│  └───────────────────────────────┘  │
├─────────────────────────────────────┤
│  2. Map Columns                     │
│  CSV Column    →  Candidate Field   │
│  "Full Name"   →  [Name ▾]         │
│  "E-mail"      →  [Email ▾]        │
│  "CV Link"     →  [Resume URL ▾]   │
│  "City"        →  [Location City ▾]│
├─────────────────────────────────────┤
│  3. Preview (first 5 rows)          │
├─────────────────────────────────────┤
│  [Cancel]              [Import 847] │
└─────────────────────────────────────┘
```

## Edge Function Update

The `batch-re-enrich` function already handles external URLs (line 140-148 checks `fileUrl.startsWith('http')`). We just need to also query candidates where `resume_url IS NOT NULL` and `current_job_title IS NULL` (no attachment required), so candidates imported via CSV with a resume URL get picked up by the enrichment pipeline.

## Key Details

- CSV parsing is done entirely client-side (no edge function needed for parsing)
- Candidate creation uses existing `addCandidate` with duplicate detection (email-based)
- Batch size for DB inserts: 50 rows at a time to avoid UI freezing
- Resume URLs are stored on `candidates.resume_url` field (already exists in schema)
- After import completes, a prompt suggests running Batch Enrichment for candidates with resume URLs
- Also fixes the Enrichment tab visibility (`grid-cols-5` → `grid-cols-6`)


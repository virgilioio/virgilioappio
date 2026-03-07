

# Fix: Batch Re-Enrich Finds 0 Candidates

## Problem

The `batch-re-enrich` edge function filters candidates using `.is('current_job_title', null)`. Now that the CSV import maps `current_job_title`, candidates with that field populated are invisible to the enrichment queries — even though they have `enrichment_status: 'pending'` and need full AI parsing.

The logs confirm: `Found 0 candidates to process`.

## Fix

**File**: `supabase/functions/batch-re-enrich/index.ts`

Replace the `current_job_title IS NULL` filter in all 4 queries (2 dry-run + 2 processing) with an `enrichment_status`-based filter:

**Dry-run query 1** (candidates with attachments):
```
- .is('current_job_title', null)
+ .in('enrichment_status', ['pending', 'pending_reparse'])
```

**Dry-run query 2** (candidates with resume_url):
```
- .not('resume_url', 'is', null)
- .is('current_job_title', null)
+ .not('resume_url', 'is', null)
+ .or('enrichment_status.in.(pending,pending_reparse),and(enrichment_status.is.null,profile_summary.is.null)')
```

**Processing query 1** (attachment candidates):
```
- .is('current_job_title', null)
+ .in('enrichment_status', ['pending', 'pending_reparse'])
```

**Processing query 2** (URL candidates):
```
- .is('current_job_title', null)
+ .or('enrichment_status.in.(pending,pending_reparse),and(enrichment_status.is.null,profile_summary.is.null)')
```

This ensures:
1. Fresh CSV imports with `enrichment_status = 'pending'` are found immediately
2. Old candidates without `enrichment_status` but missing `profile_summary` are still caught as a fallback
3. Candidates already enriched (status = `'completed'`) are skipped

After editing, the function will be redeployed automatically.

| File | Change |
|---|---|
| `supabase/functions/batch-re-enrich/index.ts` | Replace `current_job_title IS NULL` with `enrichment_status`-based filtering in all 4 queries |


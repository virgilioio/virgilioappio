

# Bulletproofing Batch Enrichment Stability

## Problems Remaining

1. **No query limit/pagination**: `getCandidates()` fetches ALL candidates with no `.limit()`. With 1000+ records, this is a heavy query that can timeout under concurrent load.

2. **Real-time still fires during enrichment**: The debounce helps (2s), but during a 30-candidate batch with 1s delay between each, enrichment takes ~30s. The debounce resets on each update, so it fires once at the end — but `getCandidates()` is called while the *next* batch is already running, stacking queries.

3. **Batch size too large for edge function timeout**: 30 candidates with resume downloads + PDF parsing + AI calls can easily exceed the 60s edge function timeout, causing partial failures.

4. **No backoff on errors**: The frontend runner retries immediately on the next batch even if the previous one timed out, compounding the problem.

5. **"Check Remaining" with `limit: 1000`**: The dry-run query fetches up to 1000 candidates with a JOIN on `candidate_attachments` — this is the heaviest query in the system.

## Fixes

### 1. Pause real-time during batch enrichment (Frontend)
**File**: `src/components/settings/BatchEnrichmentRunner.tsx`

Add a global flag (via a simple context or window variable) that tells `useIndependentCandidates` to skip real-time refreshes while enrichment is running. The subscription stays open but the callback becomes a no-op.

### 2. Reduce batch size from 30 to 10 (Frontend)
**File**: `src/components/settings/BatchEnrichmentRunner.tsx`

Smaller batches = shorter edge function execution time = fewer timeouts. Increase inter-batch delay from 5s to 8s.

### 3. Add pagination to getCandidates (Frontend)
**File**: `src/hooks/useIndependentCandidates.ts`

Add `.limit(1000)` explicitly to the candidates query as a safety net (matches Supabase default but makes it explicit). This prevents unbounded queries.

### 4. Add retry with exponential backoff (Frontend)
**File**: `src/components/settings/BatchEnrichmentRunner.tsx`

If a batch invocation fails (timeout/error), retry up to 2 times with increasing delay (10s, 20s) before moving on or stopping.

### 5. Reduce dry-run query weight (Edge Function)
**File**: `supabase/functions/batch-re-enrich/index.ts`

For dry-run, use `select('id', { count: 'exact', head: true })` instead of fetching all 1000 candidate rows. Just return the count.

### 6. Add concurrency guard to getCandidates (Frontend)
**File**: `src/hooks/useIndependentCandidates.ts`

Use an `isFetchingRef` to prevent overlapping `getCandidates()` calls. If one is already in-flight, skip the new one.

## Summary of file changes

| File | Changes |
|---|---|
| `src/hooks/useIndependentCandidates.ts` | Add fetch-in-progress guard, add `.limit(1000)`, skip real-time refresh when enrichment flag is set |
| `src/components/settings/BatchEnrichmentRunner.tsx` | Reduce batch to 10, increase delay to 8s, add retry with backoff, set/clear enrichment-active flag |
| `supabase/functions/batch-re-enrich/index.ts` | Optimize dry-run to use count-only query, reduce default limit to 10 |


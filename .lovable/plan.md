

# Bulk Upload Audit — Issues Found and Fix Plan

## Issues Identified

### 1. Stale closure bug in toast summary (Critical)
In `useBulkCandidateUpload.ts` line 208, `calculateSummary(fileResults)` reads the `fileResults` state at the time the `uploadCandidates` function was created — not the final state after all files processed. Since `setFileResults` is async, this always reads the **initial empty array**, so the toast always shows "0 created, 0 merged, 0 failed".

**Fix**: Use a `useRef` to track results alongside state, or compute the summary from within the `setFileResults` updater. Simplest: maintain a local `results` array in `uploadCandidates` that gets updated alongside `setFileResults`.

### 2. `addCandidate` calls `getCandidates()` after every single insert (Saturation)
In `useIndependentCandidates.ts` line 197, after creating each candidate, `addCandidate` calls `getCandidates()` which fetches the entire candidate table (up to 1000 rows). For a 20-file bulk upload with concurrency 3, this fires ~20 full table fetches. This saturates the database and slows everything down.

**Fix**: Add an optional `skipRefresh` parameter to `addCandidate` (default `false`). The bulk upload hook passes `skipRefresh: true` and triggers a single refresh at the end.

### 3. `addCandidate` shows individual toasts per candidate (Noise)
Each successful create fires a "Candidate added successfully" toast. During bulk upload this floods the screen with 20+ toasts.

**Fix**: Add a `silent` option to `addCandidate` to suppress individual toasts during bulk operations.

### 4. Fire-and-forget enrichment with no throttling (Saturation)
`triggerBackgroundEnrichment` is called for every file immediately after creation. With 20 files, this fires 20 concurrent edge function calls to OpenAI in rapid succession, which can cause rate limits and timeouts.

**Fix**: Queue enrichment calls sequentially after all files are processed, with a small delay between each, instead of firing them during per-file processing.

### 5. Concurrency of 3 may be too aggressive for parse-resume edge function
Each file invokes `parse-resume` (AI call) + `enrich-candidate-profile` (AI call). 3 concurrent = 6 simultaneous AI calls. 

**Fix**: Reduce to 2 concurrent uploads, and move enrichment to post-processing.

## Changes

### `src/hooks/useIndependentCandidates.ts`
- Add `options?: { skipRefresh?: boolean; silent?: boolean }` parameter to `addCandidate`
- When `skipRefresh` is true, skip the `getCandidates()` call
- When `silent` is true, skip the success toast

### `src/hooks/useBulkCandidateUpload.ts`
- Fix stale closure: track results in a local array within `uploadCandidates`, compute summary from that
- Reduce `CONCURRENT_UPLOADS` from 3 to 2
- Pass `{ skipRefresh: true, silent: true }` to `addCandidate`
- Move `triggerBackgroundEnrichment` calls to a sequential post-processing loop with 1s delay between each
- Call `getCandidates()` once at the end (import and expose a refresh function)
- Add inter-batch delay (500ms) to avoid hammering the API

### `src/hooks/useIndependentCandidates.ts` (expose refresh)
- Export `getCandidates` from the hook so the bulk upload can call it once at the end


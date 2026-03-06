

# Batch Enrich All Candidates — 30 at a time

## Approach

Rather than relying on a single long-running edge function call, build a **client-side batch runner** in the Settings page (admin-only) that:

1. First does a **dry run** to count how many candidates need enrichment
2. Then loops: calls `batch-re-enrich` with `limit: 15` repeatedly (two calls = 30 candidates per cycle)
3. Shows real-time progress (processed / total, success/fail counts)
4. Waits 5 seconds between batches to avoid OpenAI rate limits
5. Auto-stops when no more candidates are returned

Why 15 per edge function call (not 30): The batch function downloads each resume + calls enrich endpoint with 2s delays. 15 × 2s = 30s, well within the 60s edge function timeout. Two sequential calls of 15 = 30 candidates per cycle.

## Changes

### 1. Update `batch-re-enrich` edge function
- Reduce delay between candidates from 2s to 1s (since `enrich-candidate-profile` returns 202 instantly)
- This lets us process 30 per call within timeout

### 2. New component: `src/components/settings/BatchEnrichmentRunner.tsx`
- "Batch Enrich All" card with:
  - "Check remaining" button (dry run) showing count
  - "Start Enrichment" button that auto-loops
  - Progress bar and live stats (queued, skipped, failed)
  - "Stop" button to pause between batches
  - Completion message when done

### 3. Add to Settings page
- Add the component under an existing admin-only tab (Platform Settings or similar)

## Files

| Action | File |
|---|---|
| **Modified** | `supabase/functions/batch-re-enrich/index.ts` — reduce delay to 1s, process 30 safely |
| **New** | `src/components/settings/BatchEnrichmentRunner.tsx` — batch runner UI |
| **Modified** | `src/pages/Settings.tsx` or relevant settings tab — mount the runner |



## Root cause

`src/hooks/useNewApplicationsQueue.ts` selects a non-existent column, which makes every application chunk fail:

```ts
.from('job_candidate_associations')
.select(`
  id, candidate_id, current_stage_id, entered_stage_at, created_at,
  source,                       // ❌ this column does not exist on job_candidate_associations
  candidates!inner(id, candidate_name)
`)
```

Confirmed against the DB:
- `job_candidate_associations` columns include `id, candidate_id, job_id, status, current_stage_id, entered_stage_at, created_at, …` — **no `source`**.
- Pablo Sergio Guevara Herrera has a valid, active `application_review` row (assoc `073e1760…`, job "Senior Project Manager - Services", entered 2026-07-07 15:10 UTC).

Because of the bad column, every `.in('current_stage_id', chunk)` request returns a PostgREST error. The hook logs `[useNewApplicationsQueue] job_candidate_associations chunk failed` and `continue`s, so the final `items` array is always empty. That's why:
- The **Applications** chip count is 0.
- The "at least one application row" safety net in `QueueCard` has nothing to swap in.
- Pablo (and every other new applicant) is invisible.

The `source` field was added when we tried to render "applied via LinkedIn/Referral/…". The correct source of truth is `candidates.source` (that column exists), so we should read it from the already-joined `candidates` row instead of from the association.

## Fix

**File:** `src/hooks/useNewApplicationsQueue.ts`

1. Remove `source,` from the `job_candidate_associations` select list.
2. Add `source` to the embedded candidate select: `candidates!inner(id, candidate_name, source)`.
3. Read `row.candidates?.source ?? null` when building each `NewApplicationItem` (the `source` field on `NewApplicationItem` stays as-is, so `buildQueue` in `Dashboard.tsx` keeps rendering "applied via {source}" unchanged).
4. Keep the chunked fetch, ordering, and error handling as they are.

No changes needed in `src/pages/Dashboard.tsx` — `buildQueue` already consumes `app.source` from the item.

## Verification

1. Reload the dashboard as the tenant owner and confirm:
   - "Applications" chip count > 0.
   - Pablo Sergio Guevara Herrera appears as a **New application** row on both the "Everything" and "Applications" tabs, with context `Senior Project Manager - Services — applied` (or `applied via …` if `candidates.source` is set).
2. Open browser console — the `[useNewApplicationsQueue] job_candidate_associations chunk failed` warning should be gone.
3. Run `bunx tsgo --noEmit` to confirm no type regressions.

## Technical notes

- We intentionally do not add a `source` column to `job_candidate_associations`. The current data model tracks source at the candidate level, and every consumer of `NewApplicationItem.source` is happy with the candidate-level value.
- No other hook selects `jca.source`, so this is the only site to patch (confirmed via search).

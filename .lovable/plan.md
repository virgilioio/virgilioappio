## Backfill: Cleanup rejections on inactive jobs

Flip `job_candidate_associations` to `rejected` with rejection reason **"Cleanup?"** for candidates attached to jobs in `draft`, `closed`, or `archived` status.

### Scope
- **Jobs included:** status in (`draft`, `closed`, `archived`) — 86 jobs total (1 draft, 59 closed, 26 archived)
- **Candidates included:** associations with status NOT IN (`rejected`, `hired`, `offer`)
- **Protected:** `hired` and `offer` candidates are left untouched
- **Estimated impact:** ~230 `active` rows (the 4 `offer` rows are now excluded)

### What changes per row
- `status` → `'rejected'`
- `rejection_reason_id` → `8e7611b3-6e15-4d34-9127-81d9e9aa9d2c` ("Cleanup?", global)
- `rejected_at` → `now()` if currently null (preserve existing timestamps)
- `updated_at` → `now()`

### What does NOT change
- No emails sent, no stage history rewrite, no scorecard/booking changes
- No touch to `current_stage_id`
- Already-rejected rows are skipped (no reason overwrite)

### SQL
```sql
UPDATE public.job_candidate_associations jca
SET
  status = 'rejected',
  rejection_reason_id = '8e7611b3-6e15-4d34-9127-81d9e9aa9d2c',
  rejected_at = COALESCE(jca.rejected_at, now()),
  updated_at = now()
FROM public.jobs j
WHERE j.id = jca.job_id
  AND j.status IN ('draft','closed','archived')
  AND jca.status NOT IN ('rejected','hired','offer');
```

Approve to run.

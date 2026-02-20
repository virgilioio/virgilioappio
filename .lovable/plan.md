
## Root Cause

The trigger `trg_log_stage_activity` is attached to the wrong table.

- It fires on: `job_candidate_stage_history`
- It calls: `log_candidate_stage_activity()`
- That function reads: `NEW.current_stage_id`
- But `job_candidate_stage_history` has: `from_stage_id` / `to_stage_id` — **no `current_stage_id` column**

This means every single time a candidate moves between pipeline stages, the flow is:

1. `job_candidate_associations` UPDATE fires `trg_log_candidate_stage_change` → inserts a row into `job_candidate_stage_history` ✅
2. That INSERT into `job_candidate_stage_history` fires `trg_log_stage_activity` → calls `log_candidate_stage_activity()` which accesses `NEW.current_stage_id` ❌ — column doesn't exist → **PostgreSQL error 42703 → 400 returned to the client**

The stage move itself is blocked by this trigger crash.

## The Fix

Drop the misattached trigger from `job_candidate_stage_history`. The activity logging for stage changes is already properly handled by `log_candidate_stage_activity` being triggered from `job_candidate_associations` (which does have `current_stage_id`) via a separate trigger on that table.

**One-line migration:**

```sql
DROP TRIGGER IF EXISTS trg_log_stage_activity ON public.job_candidate_stage_history;
```

This is safe because:
- The function `log_candidate_stage_activity` still exists and is correctly attached to `job_candidate_associations` via other trigger wiring — stage-change activity logging continues to work
- The only thing removed is the broken, misfired attachment on the wrong table

## Files Changed

- One database migration only — `DROP TRIGGER IF EXISTS trg_log_stage_activity ON public.job_candidate_stage_history;`
- No code changes, no edge function changes, no schema changes

## Impact

After this fix, moving candidates between pipeline stages will work immediately without errors.

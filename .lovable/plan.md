

# Audit: Feb 20 Migration Fallout + Fix for New Bug

## Issues Found

### Issue 1 (CRITICAL - Active Bug): Wrong column name in our fix migration
The migration we **just applied** (`20260224214030`) references `js.name` on the `job_stages` table, but the actual column is `js.stage_name`. This means every time a candidate is moved between stages, the trigger will fail with:
```
ERROR: column js.name does not exist
```
This was introduced by our fix, not the Feb 20 migration itself.

### Issue 2 (Low Priority): Orphan function `log_candidate_stage_activity()`
The Feb 20 migration created a function called `log_candidate_stage_activity()` that:
- Uses the wrong enum value `'stage_changed'` (same bug we just fixed in the other functions)
- Is **not attached to any trigger** -- the actual trigger (`trg_log_candidate_stage_change`) calls `log_candidate_stage_change()`, not this function

This is dead code. It doesn't cause errors, but it's confusing to have around.

### Summary of Active Triggers on `job_candidate_associations`

```text
Trigger Name                        Event              Calls Function
-------------------------------     ----------------   ---------------------------
trg_log_candidate_job_assignment    AFTER INSERT       log_candidate_job_assignment()     -- OK
trg_log_candidate_stage_change      AFTER UPDATE       log_candidate_stage_change()       -- BROKEN (js.name)
trg_log_candidate_status_change     AFTER UPDATE       log_candidate_status_change()      -- FIXED (just now)
```

## The Fix

**Single database migration** that:

1. Replaces `log_candidate_stage_change()` to use the correct column `js.stage_name` instead of `js.name`
2. Drops the orphan function `log_candidate_stage_activity()` to clean up dead code

No frontend code changes needed.

## Technical Detail

The fix changes two lines in the stage change function:
```sql
-- Before (broken):
COALESCE(jhs.custom_stage_name, js.name)

-- After (correct):
COALESCE(jhs.custom_stage_name, js.stage_name)
```

And drops the unused function:
```sql
DROP FUNCTION IF EXISTS public.log_candidate_stage_activity() CASCADE;
```

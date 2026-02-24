

# Fix: "Invalid input value for enum activity_type: status_changed"

## What Happened

A recent database migration (from Feb 20) created a trigger on the `job_candidate_associations` table that fires whenever a candidate's status or stage changes. The trigger calls `log_activity()` to record the event, but it uses **incorrect enum values**:

| Used in trigger | Correct enum value |
|---|---|
| `'status_changed'` | `'candidate_status_changed'` |
| `'stage_changed'` | `'candidate_stage_changed'` |

Because `'status_changed'` is not a valid value in the `activity_type` enum, Postgres rejects the insert with error code `22P02`, which crashes the entire unreject/status-change operation.

## Why It Was Caused

The migration that created this trigger was written with shortened enum names (`status_changed`, `stage_changed`) instead of the full prefixed names (`candidate_status_changed`, `candidate_stage_changed`) that were established in the original enum definition. This is a simple naming mismatch -- the trigger was never tested against the actual enum values.

## The Fix

A single database migration to replace the trigger function with corrected enum values:

- Change `'status_changed'::activity_type` to `'candidate_status_changed'::activity_type`
- Change `'stage_changed'::activity_type` to `'candidate_stage_changed'::activity_type`

No frontend code changes needed -- the error originates entirely in the database trigger.


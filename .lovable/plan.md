
## The Problem: Missing NULL Guard on Activity-Logging Triggers

### What Is Happening

When a public applicant submits through a job posting, the `public-submit-application` edge function runs as the **service role** (no authenticated user). This means `auth.uid()` is `NULL` throughout the entire database session.

The flow that triggers the error:

```text
public-submit-application (service role, auth.uid() = NULL)
  → INSERT into candidates          → trg_log_candidate_created → GUARDED ✅ (skips when uid=NULL)
  → INSERT into job_candidate_associations → trg_log_candidate_assigned → NO GUARD ❌
                                                        → log_activity(p_user_id = NULL)
                                                        → INSERT into activities(user_id = NULL)
                                                        → ERROR: NOT NULL violated
```

This error is surface-level reported as a file upload failure because when the `job_candidate_associations` INSERT fails (transaction rolls back), the file attachment insert also fails with a confusing cascading error message.

### The Fix: Add NULL Guards to All Unprotected Activity Triggers

The `log_candidate_created` trigger was correctly patched with a NULL guard in migration `20260220154610`. The same pattern needs to be applied to every other activity-logging trigger function that can fire during unauthenticated operations.

**Triggers that need NULL guards:**

| Trigger Function | Fires On | Missing Guard |
|---|---|---|
| `log_candidate_job_assignment` | `job_candidate_associations` INSERT | Yes — uses `COALESCE(NEW.created_by, auth.uid())` but no `IF IS NULL THEN RETURN` |
| `log_candidate_stage_activity` | `job_candidate_associations` UPDATE | Yes — uses `auth.uid()` directly |
| `log_candidate_status_change` | `job_candidate_associations` UPDATE | Yes — uses `auth.uid()` directly |
| `log_candidate_updated` | `candidates` UPDATE | Yes — uses `auth.uid()` directly |

### Technical Details

The fix for each trigger is the same pattern already used in `log_candidate_created`:

```sql
-- Resolve user_id: prefer explicit column, fall back to JWT sub
v_user_id := COALESCE(NEW.created_by, auth.uid());  -- or just auth.uid() where no created_by

-- Guard: skip activity logging when there is no authenticated user
-- (e.g. service-role inserts from public job applications)
IF v_user_id IS NULL THEN
  RETURN NEW;
END IF;
```

### Files Changed

**One database migration** — `CREATE OR REPLACE` for the four trigger functions above, each adding the NULL guard before calling `log_activity`. No edge function changes. No frontend changes.

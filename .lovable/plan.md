

## Fix Job Postings Not Appearing on Careers Page

### Root Cause

There's a bug in the interaction between the frontend and the database trigger:

1. **Frontend** (`src/hooks/useJobPostings.ts` line 87) inserts job postings with `tenant_id: '00000000-0000-0000-0000-000000000000'` as a placeholder
2. **Database trigger** (`auto_set_job_posting_tenant_id`) checks `IF NEW.tenant_id IS NOT NULL THEN RETURN NEW` -- since the placeholder UUID is NOT null, the trigger skips the lookup entirely
3. The posting is saved with the all-zeros UUID, which doesn't match any tenant
4. The careers page filters by the real tenant ID, so these postings are invisible

Two postings are currently broken:
- "Sr Analyst Manager" 
- "Especialista en Nominas"

### Fix (Two Parts)

**Part 1: Fix the trigger (database migration)**

Update the trigger function to also treat the all-zeros placeholder UUID as "not set":

```sql
-- Change from:
IF NEW.tenant_id IS NOT NULL THEN RETURN NEW;

-- Change to:
IF NEW.tenant_id IS NOT NULL 
   AND NEW.tenant_id != '00000000-0000-0000-0000-000000000000' THEN
  RETURN NEW;
END IF;
```

**Part 2: Fix the frontend code**

In `src/hooks/useJobPostings.ts`, remove the `tenant_id` placeholder from the insert call entirely. The trigger will populate it automatically from the parent job. The column is NOT NULL with a default, so omitting it or passing null will let the trigger do its job.

**Part 3: Backfill the two broken postings**

Run a one-time update to fix the existing broken records:

```sql
UPDATE job_postings 
SET tenant_id = j.tenant_id,
    location = j.location,
    job_type = j.level::text
FROM jobs j
WHERE job_postings.job_id = j.id
  AND job_postings.tenant_id = '00000000-0000-0000-0000-000000000000';
```

### Files Changed

| File | Change |
|---|---|
| Database migration | Fix trigger to treat all-zeros UUID as unset; backfill 2 broken records |
| `src/hooks/useJobPostings.ts` | Remove `tenant_id: '00000000-...'` placeholder from insert (line 87) |

### Result

- The two missing job postings will immediately appear on the careers page
- All future postings will have the correct tenant_id set by the trigger
- No other tables or features are affected


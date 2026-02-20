
## Root Cause: Public Applicants Have No `organization_id`

### What Is Happening

When a candidate applies via a public job posting, the edge function creates them in the `candidates` table **without setting `organization_id`** (it was intentionally omitted because the edge function runs as service-role with no auth context). This is the correct behavior for that flow.

However, the `get_candidate_activities` RPC has a hard guard:

```sql
SELECT c.organization_id INTO v_org_id FROM candidates WHERE c.id = p_candidate_id;

IF v_org_id IS NULL THEN
  RAISE EXCEPTION 'Candidate not found or has no organization: %', p_candidate_id;
  -- This throws HTTP 400 for every inbound applicant
END IF;
```

Since `organization_id` is `NULL` for all 20 public applicants, opening any of them crashes the activity feed with a 400 error.

### Two-Part Fix

**Fix 1: Make the RPC resilient — infer `organization_id` from job association**

Instead of crashing when `organization_id` is null, fall back to looking it up via `job_candidate_associations → jobs.organization_id`:

```sql
-- Current (breaks):
SELECT c.organization_id INTO v_org_id FROM candidates WHERE c.id = p_candidate_id;
IF v_org_id IS NULL THEN RAISE EXCEPTION '...'; END IF;

-- Fixed:
SELECT c.organization_id INTO v_org_id FROM candidates WHERE c.id = p_candidate_id;

-- Fallback: infer org from job association (covers public applicants)
IF v_org_id IS NULL THEN
  SELECT j.organization_id INTO v_org_id
  FROM job_candidate_associations jca
  JOIN jobs j ON j.id = jca.job_id
  WHERE jca.candidate_id = p_candidate_id
  LIMIT 1;
END IF;

-- Only fail if we truly cannot find an org at all
IF v_org_id IS NULL THEN
  RAISE EXCEPTION 'Candidate not found or has no organization: %', p_candidate_id;
END IF;
```

**Fix 2: Backfill existing public applicants' `organization_id`**

For the 20 existing candidates who already have `NULL organization_id`, run a one-time backfill using their job associations:

```sql
UPDATE candidates c
SET organization_id = j.organization_id
FROM job_candidate_associations jca
JOIN jobs j ON j.id = jca.job_id
WHERE jca.candidate_id = c.id
AND c.organization_id IS NULL;
```

**Fix 3: Ensure the edge function sets `organization_id` going forward**

In `public-submit-application/index.ts`, the `candidateData` object should include `organization_id: posting.organization_id` (the posting already has this from the DB fetch). This prevents future applicants from having a null org.

### Why This Is Not Related to the Previous Trigger Fix

The trigger fix (null `user_id` guard) was correct and is still needed. This is a completely separate issue — the `organization_id` field was never set on public candidates, which breaks the access-check in `get_candidate_activities`.

### Files / Objects Modified

| Object | Change |
|--------|--------|
| `get_candidate_activities` DB function | Add fallback: look up org via job association if `organization_id` is null on the candidate |
| Database migration (SQL) | Backfill `organization_id` for the 20 existing public applicants from their job associations |
| `supabase/functions/public-submit-application/index.ts` | Add `organization_id: posting.organization_id` to `candidateData` so future applicants are stored correctly |

### What This Does NOT Require

- No schema changes
- No RLS policy changes
- No new tables
- The edge function redeploy is minor (one field added to an insert)

### Expected Result After Fix

Opening any inbound applicant's profile will load the activity feed without error. Existing and future public applicants will all have a valid `organization_id`, making all RPCs that depend on it work correctly.

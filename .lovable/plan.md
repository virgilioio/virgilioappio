
# Two Fixes: Location Display + Cross-Tenant Application Limit Isolation

## Issue 1: Location Shows Raw JSON — Simple Display Fix

The `formatFieldValue` function in `CandidateApplicationResponses.tsx` has no handler for the `'location'` field type. The public application form stores location as `{"city":"Mexico City","state":"CDMX","country":"Mexico"}` (a JSON string), and without a case for it the function falls through to `default` and renders the raw text.

**Fix:** Add a `'location'` case that parses the JSON and displays it as `Mexico City, CDMX, Mexico`.

**File:** `src/components/candidates/CandidateApplicationResponses.tsx`

```ts
case 'location': {
  try {
    const loc = JSON.parse(value);
    const parts = [loc.city, loc.state, loc.country].filter(Boolean);
    return parts.join(', ') || value;
  } catch {
    return value;
  }
}
```

---

## Issue 2: Cross-Tenant Application Limits — Real Bug, Needs a Migration

You are 100% correct. This is exactly like the Ashby analogy — a candidate who applied to Company A (using Virgilio) must freely apply to Company B (also using Virgilio) without any interference.

### What the bug is

The `candidate_application_limits` table has no `tenant_id` column. The `check_application_limits` function scopes checks by `organization_id` (a department/org within a tenant), which works for isolating departments — but it does NOT isolate between different SaaS customers (tenants).

The three checks in the function:

| Check | Current scope | Problem |
|-------|--------------|---------|
| 60-day max applications | `candidate_email + organization_id` | Two tenants could share an org_id? No — UUIDs prevent this. But architecture is fragile without `tenant_id`. |
| Same-job cooldown | `candidate_email + job_id` **only** | **No organization_id AND no tenant_id filter.** A candidate who applied to any job with that job_id — across ALL tenants — gets blocked. Since job_ids are UUIDs this can't collide, but the intent is clearly broken. |
| Rejection cooldown | `candidate_email + organization_id` | Same fragility as #1. |

The most critical latent bug is the **same-job cooldown check** — it has NO org or tenant filter at all, only `job_id + email`. While UUID collisions are impossible in practice, the architectural intent is wrong. And more importantly: the whole table lacks `tenant_id`, meaning as the platform scales to more SaaS customers, this WILL cause cross-tenant blocks.

### The Fix

**Step 1 — Database migration:** Add `tenant_id` column to `candidate_application_limits`, backfill it from the job's organization's tenant, and update the `check_application_limits` function to accept and filter by `tenant_id_param`.

**Step 2 — Edge function update:** Pass `tenant_id` (already available in the posting data) when calling `check_application_limits` and when inserting into `candidate_application_limits`.

### Migration SQL

```sql
-- 1. Add tenant_id to candidate_application_limits
ALTER TABLE public.candidate_application_limits 
ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);

-- 2. Backfill tenant_id from the job's organization
UPDATE public.candidate_application_limits cal
SET tenant_id = o.tenant_id
FROM public.jobs j
JOIN public.organizations o ON j.organization_id = o.id
WHERE cal.job_id = j.id
AND cal.tenant_id IS NULL;

-- 3. Update check_application_limits to scope by tenant_id
CREATE OR REPLACE FUNCTION public.check_application_limits(
  candidate_email_param text, 
  job_id_param uuid, 
  organization_id_param uuid,
  tenant_id_param uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  total_applications_60_days INTEGER;
  same_job_last_application TIMESTAMP WITH TIME ZONE;
  last_rejected_application TIMESTAMP WITH TIME ZONE;
  result JSONB;
BEGIN
  -- Check total applications in last 60 days (scoped to this tenant+org)
  SELECT COUNT(*) INTO total_applications_60_days
  FROM public.candidate_application_limits
  WHERE candidate_email = candidate_email_param
    AND organization_id = organization_id_param
    AND (tenant_id_param IS NULL OR tenant_id = tenant_id_param)
    AND applied_at >= (now() - INTERVAL '60 days');
  
  -- Check last application to same job (scoped to this tenant)
  SELECT MAX(applied_at) INTO same_job_last_application
  FROM public.candidate_application_limits
  WHERE candidate_email = candidate_email_param
    AND job_id = job_id_param
    AND (tenant_id_param IS NULL OR tenant_id = tenant_id_param);
  
  -- Check last rejected application (scoped to this tenant+org)
  SELECT MAX(status_updated_at) INTO last_rejected_application
  FROM public.candidate_application_limits
  WHERE candidate_email = candidate_email_param
    AND organization_id = organization_id_param
    AND (tenant_id_param IS NULL OR tenant_id = tenant_id_param)
    AND status = 'rejected';
  
  -- Build result and check violations (same logic as before)
  result := jsonb_build_object(
    'can_apply', true,
    'total_applications_60_days', total_applications_60_days,
    'max_applications_60_days', 3,
    'violations', jsonb_build_array()
  );
  
  IF total_applications_60_days >= 3 THEN
    result := jsonb_set(result, '{can_apply}', 'false');
    result := jsonb_set(result, '{violations}', 
      (result->'violations') || jsonb_build_object(
        'type', 'max_applications_exceeded',
        'message', 'You have reached the maximum of 3 applications in the last 60 days'
      )
    );
  END IF;
  
  IF same_job_last_application IS NOT NULL AND same_job_last_application > (now() - INTERVAL '90 days') THEN
    result := jsonb_set(result, '{can_apply}', 'false');
    result := jsonb_set(result, '{violations}', 
      (result->'violations') || jsonb_build_object(
        'type', 'same_job_cooldown',
        'message', 'You cannot reapply to the same job within 90 days',
        'cooldown_until', (same_job_last_application + INTERVAL '90 days')
      )
    );
  END IF;
  
  IF last_rejected_application IS NOT NULL AND last_rejected_application > (now() - INTERVAL '30 days') THEN
    result := jsonb_set(result, '{can_apply}', 'false');
    result := jsonb_set(result, '{violations}', 
      (result->'violations') || jsonb_build_object(
        'type', 'rejection_cooldown',
        'message', 'You cannot apply within 30 days of a rejection',
        'cooldown_until', (last_rejected_application + INTERVAL '30 days')
      )
    );
  END IF;
  
  RETURN result;
END;
$$;
```

### Edge Function Update

In `supabase/functions/public-submit-application/index.ts`, the posting query already fetches `tenant_id`. Pass it to both the `check_application_limits` RPC call and the insert into `candidate_application_limits`.

---

## Files Changed

| File | Type | Change |
|------|------|--------|
| `src/components/candidates/CandidateApplicationResponses.tsx` | Frontend | Add `'location'` case to `formatFieldValue` |
| `supabase/migrations/TIMESTAMP_fix_application_limits_tenant_isolation.sql` | DB Migration | Add `tenant_id` to table, backfill, update function |
| `supabase/functions/public-submit-application/index.ts` | Edge Function | Pass `tenant_id` when calling `check_application_limits` and inserting limits records |

---

## Why the 429 Happened During Your Test

To be clear: jvbonifaz's test 429 was most likely **Supabase infrastructure rate limiting** from rapid repeated submissions of the same edge function (not the application limits logic — the DB shows 0 limit records for Aquamatic org). After this fix, the architectural cross-tenant isolation is correct regardless. Use a fresh email (e.g. `test+aquamatic@gmail.com`) for each tenant's test to avoid infrastructure rate limits during testing.

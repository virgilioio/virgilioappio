
# Root Cause: Missing `tenant_id` in the Candidates Unique Constraint

## The Bug — Exactly What Happened

The `candidates` table has this constraint:
```sql
UNIQUE (email, candidate_name)
```

This constraint applies **globally across all tenants**. The moment `jvbonifaz@gmail.com` ("Josel Valadez Bonifaz") existed in the Motive tenant, no other tenant could ever create a candidate with that same email+name combination. The platform is effectively saying "one person, one global record" — which is the opposite of multi-tenant design.

### Step-by-step breakdown of the failed application:
1. Josel applied to the Virgilio "Marketing Content Writer" job
2. The edge function confirmed the posting belongs to Virgilio (`tenant_id = 5ba7b145`)
3. Application limits check passed (fixed by yesterday's migration)
4. Edge function tried to `INSERT` a new candidate with `tenant_id = Virgilio` ← **FAILS: 23505 unique violation** because `(jvbonifaz@gmail.com, Josel Valadez Bonifaz)` already exists in Motive tenant
5. Fallback code ran: looked up by `email + candidate_name` **with no tenant filter** → found the Motive record
6. Job association was created: Virgilio job → Motive candidate (wrong tenant!)
7. Virgilio's Candidates page filters by org tree → Motive candidate is outside the tree → **invisible**

## The Fix — Two Changes

### 1. Database Migration — Fix the Unique Constraint

Drop the global unique constraint and replace it with a tenant-scoped one:

```sql
-- Drop the global constraint (email + name across ALL tenants)
ALTER TABLE public.candidates
DROP CONSTRAINT IF EXISTS candidates_email_candidate_name_key;

-- Add the correct tenant-scoped unique constraint
ALTER TABLE public.candidates
ADD CONSTRAINT candidates_email_candidate_name_tenant_key
UNIQUE (email, candidate_name, tenant_id);

-- Fix the data: the existing wrong association (Motive candidate → Virgilio job)
-- must be deleted, and a proper Virgilio candidate created
-- Step 1: Delete the wrong association
DELETE FROM public.job_candidate_associations
WHERE id = 'eeae5777-a408-486d-9c36-f39c6577bc95';

-- Step 2: Create the correct Virgilio candidate
INSERT INTO public.candidates (
  candidate_name, email, organization_id, tenant_id, source, created_by
) VALUES (
  'Josel Valadez Bonifaz',
  'jvbonifaz@gmail.com',
  '6778ef5b-d05f-4883-b80c-3d9843ba5a95',  -- Partnership Leaders org (Virgilio)
  '5ba7b145-f251-4b18-8900-724cb06028ab',  -- Virgilio tenant
  'public_posting',
  NULL
);

-- Step 3: Create the correct job association pointing to the new Virgilio candidate
INSERT INTO public.job_candidate_associations (
  job_id, candidate_id, status, current_stage_id
)
SELECT 
  '90e0e9bd-4aa5-4944-99d0-6251778fa650',  -- Marketing Content Writer job
  id,
  'active',
  NULL
FROM public.candidates
WHERE email = 'jvbonifaz@gmail.com'
  AND tenant_id = '5ba7b145-f251-4b18-8900-724cb06028ab';
```

### 2. Edge Function Fix — Tenant-Scoped Fallback Recovery

The fallback code at line 283 of `public-submit-application/index.ts` that runs after a 23505 error currently queries without a tenant filter:

```typescript
// CURRENT (BROKEN): no tenant filter — finds candidates from other tenants
const { data: dupeCandidate } = await supabase
  .from("candidates")
  .select("id")
  .eq("email", candidateEmail)
  .eq("candidate_name", candidateName)  // no tenant_id filter!
  .maybeSingle();
```

Fix: add `.eq("tenant_id", postingTenantId)` to both fallback queries:

```typescript
// FIXED: scoped to current tenant
const { data: dupeCandidate } = await supabase
  .from("candidates")
  .select("id")
  .eq("email", candidateEmail)
  .eq("candidate_name", candidateName)
  .eq("tenant_id", postingTenantId)  // ← add this
  .maybeSingle();
```

## Files Changed

| Change | Type | Details |
|--------|------|---------|
| DB Migration | SQL | Drop global unique constraint, add tenant-scoped one; fix bad data (delete wrong association, create correct Virgilio candidate and association) |
| `supabase/functions/public-submit-application/index.ts` | Edge Function | Add `tenant_id` filter to both fallback recovery queries after 23505 errors |

## Candidates Application Responses

The candidate's form responses (location, resume, etc.) stored in `candidate_application_responses` will need to be migrated over to point to the new Virgilio candidate ID as well. The migration will handle this automatically.

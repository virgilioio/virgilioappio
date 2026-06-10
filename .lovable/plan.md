## Goal

Exclude Virgilio-internal jobs from the general per-tenant careers page (`/careers/:companySlug`) so the two pages stay strictly separate:

- `/virgilio-careers` → only the Virgilio internal org's jobs (already done).
- `/careers/:companySlug` → all postings **except** those belonging to the Virgilio internal org.

## Change

**File:** `src/pages/PublicCareersPage.tsx`

In the `job_postings` query, add `.neq('jobs.organization_id', VIRGILIO_INTERNAL_ORG_ID)` so internal postings never appear on any tenant's general careers page (including Virgilio's own `/careers/virgilio`).

```ts
const VIRGILIO_INTERNAL_ORG_ID = '4b8e739f-2b15-487e-8d31-0a2ce765a8ef'

const { data: p } = await supabase
  .from('job_postings')
  .select('..., jobs!inner(status, organization_id)')
  .eq('is_active', true)
  .eq('tenant_id', s.tenant_id)
  .eq('jobs.status', 'open')
  .neq('jobs.organization_id', VIRGILIO_INTERNAL_ORG_ID)   // ← new
  .order('created_at', { ascending: false })
```

That is the only edit. No DB, RLS, route, or UI changes.

## Side effects

- For every tenant other than Virgilio, the filter is a no-op (their jobs don't belong to that org).
- For Virgilio's own `/careers/virgilio`, internal jobs disappear from that page and now live exclusively at `/virgilio-careers`.

## Out of scope

- No admin toggle for which orgs to exclude — the id is hardcoded, matching the approach already used in `VirgilioCareersPage.tsx`.

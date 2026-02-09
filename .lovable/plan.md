

# Fix: "About the Company" Not Showing on Public Job Postings

## Root Cause

The RLS policy we added to `tenants` is correct and working. The actual problem is **upstream** in the data-fetching query.

On line 110-124 of `PublicJobPosting.tsx`, the query uses:

```
jobs!inner(organizations!inner(name))
```

The `!inner` modifier means: "if the joined table returns zero rows, exclude the parent row too." Since the `jobs` table has **no anonymous access policy** (its SELECT policy requires being a platform admin, org member, or assigned user), the join returns nothing for unauthenticated visitors -- and the **entire query returns null**.

Because `posting` is null, the code exits early on line 125-129 and **never reaches** the tenant query on line 136. The page shows "Posting Not Found" instead of the job with its About section.

## Solution

Remove the `jobs!inner(organizations!inner(name))` join from the query entirely. It's unnecessary because:

1. `tenant_id` is already denormalized onto `job_postings` (done previously)
2. The organization/company name is already fetched from `tenants.name` on line 144, which overwrites the org name anyway

### Changes to `src/pages/PublicJobPosting.tsx`

**Line 112-122** -- Simplify the select query:

```typescript
const { data: p } = await supabase
  .from('job_postings')
  .select(`
    id,
    job_id,
    title,
    description,
    details,
    tenant_id
  `)
  .eq('slug', slug)
  .maybeSingle()
```

**Line 132-133** -- Remove the dead code that extracts org name from the now-removed join:

```typescript
// Remove these two lines:
const orgName = (p as any)?.jobs?.organizations?.name || 'our company'
setOrganizationName(orgName)
```

Set a default before the tenant query instead:

```typescript
setOrganizationName('our company')
```

## Files Modified

| File | Change |
|------|--------|
| `src/pages/PublicJobPosting.tsx` | Remove `jobs!inner(organizations!inner(name))` join; clean up org name extraction |

## Why the RLS Migration Still Matters

The `tenants_public_read_for_postings` policy we already applied is still required -- without it, the separate tenant query on line 136-140 would also fail. Both fixes together make the full flow work:

1. Job posting query succeeds (no more blocked join) 
2. Tenant query succeeds (anon RLS policy allows reading)
3. "About the Company" renders correctly

## Risk Assessment

**Very low risk**: We're removing an unnecessary join that was already failing silently. The tenant name and about data are fetched from the dedicated tenant query that follows.

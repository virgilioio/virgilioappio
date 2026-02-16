

## Bug Fix: "About the Company" Not Displaying on Public Job Posts

### Root Cause

The `anon` (anonymous/unauthenticated) PostgreSQL role has **no table-level grants** on the `tenants` table. Even though the RLS policy `tenants_public_read_for_postings` exists and correctly allows anonymous reads for tenants with active postings, PostgreSQL requires **both**:

1. A table-level `GRANT SELECT` permission (missing)
2. An RLS policy allowing the operation (exists)

Without the grant, the query on line 131-135 of `PublicJobPosting.tsx` silently returns `null` for anonymous visitors. The code handles this gracefully (no error), but the "About" section simply never renders.

This is why it works when you're logged in (the `authenticated` role has grants) but fails for public visitors.

### Fix

**New migration file** to grant `SELECT` on the `tenants` table to the `anon` role:

```sql
GRANT SELECT ON public.tenants TO anon;
```

That's it. One line. The existing RLS policy already restricts anonymous access to only tenants that have active, non-deleted job postings — so this grant is safe. Anonymous users cannot see tenants without public postings.

### Technical Details

| Item | Detail |
|---|---|
| File to create | `supabase/migrations/[timestamp]_grant_anon_select_tenants.sql` |
| SQL | `GRANT SELECT ON public.tenants TO anon;` |
| Why it's safe | The RLS policy `tenants_public_read_for_postings` already scopes anonymous reads to only tenants with `is_active = true` and `deleted_at IS NULL` postings |
| What it fixes | The "About [Company]" section on public job posts (`/p/:slug`) and potentially the tenant name display too |

### Why This Was Missed

The migration that created the RLS policy (`20260209224252`) added the policy but didn't add the corresponding `GRANT`. RLS policies define *what rows* a role can see, but without a `GRANT`, the role can't access the table at all. Both are required.

### After Publishing

Once this migration is published to the live environment, anonymous visitors to public job posts will see the "About the Company" section rendered with the content from Settings > Workspace > Company Profile.

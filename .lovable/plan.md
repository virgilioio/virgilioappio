## What’s actually broken

The dashboard data is not empty; the database requests are failing before data can load.

The root error is:

```text
SET is not allowed in a non-volatile function
```

This is coming from RLS helper functions marked `STABLE` that also run `SET LOCAL row_security = off` or `set_config('row_security', 'off', true)`. PostgreSQL does not allow `SET` inside non-volatile functions. Because these helpers are used in RLS policies for core dashboard tables, requests to `members`, `organizations`, `jobs`, `job_candidate_associations`, and `scheduled_bookings` return 400 errors.

## Functions to fix

Update these existing functions to be `VOLATILE` instead of `STABLE`, while preserving `SECURITY DEFINER` and their current logic:

- `public.is_platform_admin()`
- `public.user_has_org_hierarchy_access(target_org_id uuid)`
- `public.user_is_workspace_owner_in_tenant(tenant_id_param uuid)`

## Why this is the right fix

- The functions intentionally change a session-local setting (`row_security`) during execution.
- That makes `VOLATILE` the correct PostgreSQL volatility category.
- This avoids weakening RLS policies or changing dashboard business logic.
- It directly targets the shared cause behind the repeated 400 errors.

## Implementation plan

1. Create a Supabase migration that redefines only the three affected functions as `VOLATILE SECURITY DEFINER`.
2. Keep the same access logic and `search_path` hardening.
3. Do not edit `src/integrations/supabase/types.ts`; it is generated from Supabase and should not be manually modified.
4. Validate by checking that the failing dashboard queries no longer return 400 errors and that the console no longer reports `SET is not allowed in a non-volatile function`.

## Safety notes

- No tables or columns need to be changed.
- No frontend behavior needs to be changed for this root issue.
- Existing RLS policies remain in place.
- The fix is limited to PostgreSQL function definitions.

<presentation-actions>
  <presentation-open-history>View History</presentation-open-history>
</presentation-actions>

<presentation-actions>
<presentation-link url="https://docs.lovable.dev/tips-tricks/troubleshooting">Troubleshooting docs</presentation-link>
</presentation-actions>
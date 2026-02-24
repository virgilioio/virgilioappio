

# Fix: Cross-Tenant Data Leakage in Global Search

## The Problem

The global search bar (`useGlobalSearch.ts`) queries the `jobs`, `candidates`, and `sourcing_projects` tables **without any tenant_id filtering**. It relies entirely on RLS policies for isolation. However, your account (platform admin) bypasses RLS tenant restrictions by design -- meaning the search returns data from **all tenants across the entire platform**. Even for non-admin users, explicit tenant filtering is a critical defense-in-depth requirement.

This affects all three search functions:
- `searchJobs` -- no tenant filter
- `searchCandidates` -- no tenant filter
- `searchSourcingProjects` -- no tenant filter

## The Fix

**File:** `src/hooks/useGlobalSearch.ts`

Add explicit tenant_id filtering to all three search functions, following the same pattern used throughout the codebase (e.g., `useAnalyticsMetrics`, `useJobAnalyticsMetrics`):

1. **Fetch tenant_id first** -- Before running any searches, query the `members` table to get the current user's `tenant_id` (same pattern as `useTenant.ts`)

2. **Filter jobs by tenant_id** -- Add `.eq('tenant_id', tenantId)` to both the count and results queries in `searchJobs`

3. **Filter candidates by tenant_id** -- Add `.eq('tenant_id', tenantId)` to both the count and results queries in `searchCandidates`

4. **Filter sourcing_projects by tenant_id** -- Add `.eq('tenant_id', tenantId)` to both the count and results queries in `searchSourcingProjects`

5. **Skip search if no tenant context** -- If tenant_id cannot be resolved (edge case), return empty results rather than leaking data

### Technical Detail

The hook will:
- Accept the Supabase `user` object (from `useAuth`) as context
- Run a one-time query to resolve `tenant_id` from the `members` table
- Pass `tenantId` into each search function
- All 6 database queries (3 counts + 3 result sets) will include `.eq('tenant_id', tenantId)`
- Platform admins will see only their own tenant's data in search (consistent with the platform's tenant isolation enforcement principle documented in the architecture)

### Components that consume this hook (no changes needed)
- `GlobalSearchBar.tsx` -- dropdown search
- `SearchResultsDialog.tsx` -- full results dialog

Both consume `useGlobalSearch` and will automatically benefit from the fix without any changes.


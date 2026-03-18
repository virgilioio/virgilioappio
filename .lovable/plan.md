

# Fix: Platform Admin Seeing Cross-Tenant Jobs on Pipeline

## Root Cause

The `useJobs` hook relies entirely on RLS (`user_has_org_hierarchy_access`) for tenant isolation. That function walks **all** active memberships the user has. If the platform admin has memberships in multiple tenant organizations (e.g., GoGio + a SaaS customer org for support), the RLS correctly grants access to both hierarchies — but the Pipeline page has no tenant filter, so it shows jobs from all accessible tenants.

This is the same pattern already solved in `useSourcingProjects`, which explicitly fetches the user's current `tenant_id` and filters by it.

## Fix

**`src/hooks/useJobs.ts`** — Add explicit tenant scoping to `getJobsOptimized`:

1. Before querying jobs, fetch the `tenant_id` for the user's current `organizationId`
2. Add `.eq('organizations.tenant_id', tenantId)` to the jobs query (using the existing `!inner` join on organizations)

This ensures the Pipeline only shows jobs belonging to the user's **current** tenant context, matching the established pattern in `useSourcingProjects`.

| File | Change |
|---|---|
| `src/hooks/useJobs.ts` | Fetch tenant_id from org context, add `.eq('organizations.tenant_id', tenantId)` filter |

No RLS or migration changes needed — the RLS policies are correct (they grant access based on membership). The issue is the client not scoping to the current tenant context.


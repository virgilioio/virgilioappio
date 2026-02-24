

# Fix: Global Search Returning 0 Results

## The Problem

The `sourcing_projects` table does not have a `tenant_id` column. The recent tenant isolation fix added `.eq('tenant_id', tenantId)` to all three search functions, including sourcing projects. This causes a database error every time a search runs.

Because all three searches execute inside a single `Promise.all` (line 108), the sourcing projects error rejects the entire promise -- **killing the jobs and candidates results too**. That's why you see 0 results for everything.

The Postgres logs confirm this with dozens of repeated errors:
```
ERROR: column sourcing_projects.tenant_id does not exist
```

## The Fix

**File:** `src/hooks/useGlobalSearch.ts`

1. **Make `searchSourcingProjects` resilient** -- Remove the `.eq('tenant_id', tenantId)` filter from sourcing projects queries since the column doesn't exist. Instead, filter by the `created_by` user ID (the owner of the project) to maintain isolation without requiring a column that doesn't exist on the table.

2. **Wrap each search in its own try/catch** -- So that if one search type fails, the other two still return results. Change `Promise.all` to `Promise.allSettled` pattern or individual catches, ensuring a single failure never kills the entire search.

### Technical Detail

For sourcing projects tenant isolation, we'll use the `created_by` column (which links to the user who created the project) combined with a subquery approach: query the `members` table to get all user IDs belonging to the same tenant, then filter sourcing projects by `created_by` being in that set. Alternatively, if the table has no reliable tenant link, we simply wrap it in a try/catch and let RLS handle isolation for non-admin users, while logging clearly when it fails.

The safer and simpler approach: wrap each search in its own catch so failures are isolated, and remove the non-existent `tenant_id` filter from sourcing projects. For sourcing projects specifically, filter by `created_by` equal to the current user's ID as a pragmatic isolation measure until a `tenant_id` column is added to that table.

```
searchJobs(...)        --> own try/catch, tenant_id filter (works)
searchCandidates(...)  --> own try/catch, tenant_id filter (works)  
searchSourcingProjects(...) --> own try/catch, filter by created_by instead
```

No other files need changes.

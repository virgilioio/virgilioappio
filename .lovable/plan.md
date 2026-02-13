

## Make "Avg Time to Hire" Ignore Job Status Filter

### Problem
Currently, the Avg Time to Hire metric is calculated from associations tied to `finalJobIds`, which are already filtered by job status. This means if the filter is set to "Open", hired candidates from closed jobs are excluded -- but jobs are often closed *because* someone was hired.

### Solution
Fetch a **second set of job IDs** that applies all filters *except* job status, and use those specifically for the Avg Time to Hire calculation.

### Changes

**File: `src/hooks/useAnalyticsMetrics.ts`**

1. After the existing `jobsQuery` (which applies the status filter), run a second query for jobs **without** the status filter -- but still applying tenant_id, organization, and recruiter filters.
2. Compute a `statusAgnosticJobIds` array from this second query.
3. Fetch associations for those job IDs (or reuse the existing ones if `statusAgnosticJobIds` is a superset of `finalJobIds`) to calculate `avgTimeToHire`.
4. If the job status filter is "all", no extra query is needed -- the existing data already covers everything.

Specifically:
- Only run the extra query when `jobStatus` is not `'all'` (to avoid redundant fetches)
- The extra query reuses the same tenant_id and organization filters, just skips the `.eq('status', ...)` call
- Apply the same recruiter and specific jobIds intersection logic to get `statusAgnosticJobIds`
- Fetch a separate set of associations scoped to `statusAgnosticJobIds` for the avgTimeToHire calculation
- All other metrics continue using the existing `finalJobIds` (status-filtered) as before

### No Other Files Changed
The Analytics page component doesn't need changes -- it already displays `avgTimeToHire` correctly. This is purely a data-layer adjustment.


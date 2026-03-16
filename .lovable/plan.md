

# Normalize Legacy Source Data and Ensure Tenant Isolation

## Overview

Merge the legacy `job_application` source into `public_posting` at the database level, and update both `normalizeSource` functions to display both as "Applied". Tenant isolation is already enforced in both hooks through the job ID filter chain (tenant jobs → associations → candidates).

## Changes

### Data Migration (UPDATE via insert tool)
```sql
UPDATE candidates SET source = 'public_posting' WHERE source = 'job_application';
```
This normalizes the 120 legacy records to match the current edge function behavior.

### `src/hooks/useJobAnalyticsMetrics.ts` (line 517)
- Add `job_application` and `public_posting` to the "Applied" normalization line

### `src/hooks/analytics/useSourcePerformanceMetrics.ts` (line 92)
- Add `job_application` and `public_posting` to the "Applied" normalization line

Both lines change from:
```
if (lower === 'applied' || lower === 'application' || lower === 'career_page' || lower === 'careers_page') return 'Applied'
```
to:
```
if (lower === 'applied' || lower === 'application' || lower === 'career_page' || lower === 'careers_page' || lower === 'job_application' || lower === 'public_posting') return 'Applied'
```

## Tenant Isolation Verification

Both source analytics paths are already tenant-bound:
- **Job Dashboard** (`useJobAnalyticsMetrics`): Verifies job belongs to user's tenant via `jobs.tenant_id` check before any data fetch
- **Analytics Page** (`useSourcePerformanceMetrics`): Receives `finalJobIds` from `useAnalyticsTenantContext` which scopes all jobs to the user's tenant

Candidate source data is only fetched for candidates linked to tenant-scoped job associations — no cross-tenant leakage is possible.

| File | Change |
|------|--------|
| Database (UPDATE) | Normalize `job_application` → `public_posting` |
| `src/hooks/useJobAnalyticsMetrics.ts` | Add `job_application`, `public_posting` to normalizeSource |
| `src/hooks/analytics/useSourcePerformanceMetrics.ts` | Add `job_application`, `public_posting` to normalizeSource |


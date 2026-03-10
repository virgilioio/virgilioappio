

# Fix: `tenant_id` column errors on `job_candidate_associations` and `job_hiring_stages`

## Problem
Both `job_candidate_associations` and `job_hiring_stages` have no `tenant_id` column. The current code filters by `.eq('tenant_id', tenantId)` on both, causing 400 errors.

## Fix (in `useTalentIntelligenceData.ts`, lines 359-405)

Restructure the fetch to avoid `tenant_id` on tables that don't have it:

1. **Fetch jobs first** (already works — `jobs` has `tenant_id`) to get tenant job IDs
2. **Fetch `job_candidate_associations`** filtered by `.in('job_id', jobIds)` instead of tenant_id — paginated
3. **Fetch `job_stages`** filtered by `.eq('tenant_id', tenantId)` (it has tenant_id) — simple query for id + stage_name
4. **Fetch `job_hiring_stages`** filtered by `.in('job_id', jobIds)` — selecting id, stage_id, job_id
5. **Join in JS**: map `job_hiring_stages.stage_id` → `job_stages.stage_name`

The Promise.all structure changes slightly: jobs must resolve first, then associations and hiring stages can run in parallel.

## File changed
- `src/hooks/useTalentIntelligenceData.ts` — rewrite the `associationsQuery.queryFn` (lines ~359-416)


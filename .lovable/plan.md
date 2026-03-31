

# Performance Optimization Plan

## Diagnosis

After reviewing the codebase, here are the key performance bottlenecks:

### 1. Jobs real-time subscriptions fire `getJobs()` with ZERO debounce
The candidates hook has a 2-second debounce on real-time changes. The jobs hook has **none** — every single `postgres_changes` event on `jobs`, `job_requests`, and `job_assignments` tables triggers an immediate full refetch. With many users, this creates a cascade of redundant fetches.

### 2. Core data hooks (`useJobs`, `useIndependentCandidates`, `useCandidates`) use raw `useState` instead of React Query
These are the most critical hooks in the app, yet they don't use React Query — meaning:
- No **stale-time caching** — every mount triggers a fresh fetch
- No **deduplication** — if 3 components use `useJobs()`, you get 3 separate fetches
- No **background refetch** — real-time subs do full state wipes instead of smooth updates
- Every mutation calls `await getJobs()` / `await getCandidates()` synchronously, blocking the UI

Meanwhile, 37 other hooks in the app already use React Query properly with `staleTime`.

### 3. Real-time creates new channels on every mount
`useJobs` creates 3 Supabase channels (jobs, job_requests, job_assignments) per mount. `useIndependentCandidates` creates 1 channel per org ID in the hierarchy. Channel IDs are random, so they're never reused.

### 4. `getJobsOptimized` fires an extra query to resolve `tenant_id` on every call
Every time jobs are fetched, there's a preliminary `SELECT tenant_id FROM organizations` query that could be cached.

## Plan

### Phase 1 — Quick wins (immediate impact, low risk)

**A. Debounce jobs real-time subscriptions**
- File: `src/hooks/useJobs.ts`
- Add a 2-second debounce (same as candidates) on all 3 real-time channel callbacks
- Prevents rapid-fire `getJobs()` when multiple records change at once

**B. Add concurrency guard to `useJobs.getJobs()`**
- File: `src/hooks/useJobs.ts`
- Same pattern as `useIndependentCandidates` — skip fetch if one is already in-flight
- Prevents overlapping fetches from real-time + manual refresh collisions

**C. Cache tenant_id resolution in `useJobs`**
- File: `src/hooks/useJobs.ts`
- Store resolved `tenantId` in a ref instead of querying `organizations` on every `getJobs()` call
- Reset ref when `organizationId` changes

### Phase 2 — Migrate core hooks to React Query (high impact, moderate effort)

This is the single biggest improvement. Convert the 3 heaviest hooks from raw `useState` + `useEffect` to React Query:

**D. Migrate `useJobs` to React Query**
- File: `src/hooks/useJobs.ts`
- Replace `useState` + `useEffect` fetch with `useQuery({ queryKey: ['jobs', organizationId], ... })`
- Set `staleTime: 60_000` (1 minute) — jobs don't change every second
- Mutations use `queryClient.invalidateQueries(['jobs'])` instead of `await getJobs()`
- Real-time subscription calls `invalidateQueries` instead of direct refetch
- Keeps `scopedJobs` memo for role-based filtering

**E. Migrate `useIndependentCandidates` to React Query**
- File: `src/hooks/useIndependentCandidates.ts`
- Same pattern: `useQuery` with `staleTime: 30_000`
- Real-time changes invalidate instead of full refetch
- Deduplicates across `Candidates.tsx` + any other consumers

**F. Migrate `useCandidates` to React Query**
- File: `src/hooks/useCandidates.ts`
- Same pattern, scoped by `jobId`

### Phase 3 — Database-side (requires Supabase Dashboard)

**G. Add missing indexes on high-traffic foreign keys**
These are the joins that run on every page load — indexes here directly reduce query time:
- `job_candidate_associations.candidate_id` (if not indexed)
- `job_candidate_associations.job_id` (if not indexed)
- `candidates.organization_id`
- `jobs.tenant_id`
- `members.user_id` + `members.organization_id` composite

**H. Optimize RLS predicates**
Wrap `auth.uid()` calls in `(select auth.uid())` to prevent re-evaluation per row. This is a known Supabase performance pattern — the subselect is evaluated once per query instead of once per row.

## Implementation order

| Step | Impact | Risk | Effort |
|------|--------|------|--------|
| A. Debounce jobs real-time | High | Very low | 15 min |
| B. Concurrency guard on getJobs | Medium | Very low | 10 min |
| C. Cache tenant_id | Low | Very low | 10 min |
| D. Migrate useJobs to React Query | Very high | Medium | 1 hour |
| E. Migrate useIndependentCandidates to RQ | Very high | Medium | 1 hour |
| F. Migrate useCandidates to RQ | High | Medium | 45 min |
| G. Add DB indexes | High | Low | Migration |
| H. Optimize RLS auth.uid() | Medium | Low | Migration |

## Recommendation

I'd suggest we start with **Phase 1 (A+B+C)** — these are safe, surgical changes that will immediately reduce redundant network requests by 50-70%. Then we can tackle Phase 2 incrementally, one hook at a time.

## Files changed

| File | Change |
|------|--------|
| `src/hooks/useJobs.ts` | Debounce real-time callbacks, add concurrency guard, cache tenant_id |
| `src/hooks/useIndependentCandidates.ts` | (Phase 2) Migrate to React Query |
| `src/hooks/useCandidates.ts` | (Phase 2) Migrate to React Query |
| DB migration | (Phase 3) Add indexes + optimize RLS |


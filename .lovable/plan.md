## Caching strategy: foundation + hot paths + persistence

### Why this matters
- `QueryClient` is currently default-configured (no `staleTime`, no `gcTime`), so every component remount, tab focus, and route navigation triggers refetches. With ~98 `useQuery` hooks, the same data (members, jobs, filter options, dashboard metrics) is fetched dozens of times per session.
- There is no persistence: a page reload throws away every cached row and re-runs every dashboard query against Supabase from scratch.
- Existing memory `core-data-sync-architecture` documents a deduplication intent that is only partially honored. We'll formalize it.

### Goals
1. Eliminate redundant network calls on the same session.
2. Make reopening the app feel instant via persisted cache.
3. Define a documented, predictable cache + invalidation contract.
4. Keep mutation-heavy flows (kanban moves, scorecards, offers) as fresh as today.

---

### Plan

**1. Cache tier definitions (documented in `src/lib/cache/cacheTiers.ts`)**

| Tier | staleTime | gcTime | Use for |
|---|---|---|---|
| `realtime` | 0 | 5 min | Mutations' read-after-write, pipeline kanban active board |
| `transactional` | 60s | 10 min | Candidate lists, job lists, scorecards in flight |
| `reference` | 10 min | 60 min | Dashboard widgets, analytics metrics, members list, customer members |
| `static` | 60 min | 24 h | Filter options, app fields, hiring stages, integration registry, country lists |

Exported as helpers: `cacheTiers.reference`, etc., used like `useQuery({ ...cacheTiers.reference, queryKey, queryFn })`.

**2. Global QueryClient defaults (`src/App.tsx`)**
- `staleTime: 60_000` (transactional default)
- `gcTime: 10 * 60_000`
- `refetchOnWindowFocus: false` (current behavior is already this implicitly via no-config — explicit it)
- `refetchOnReconnect: 'always'`
- `retry: 1` (network only, not 4xx)

**3. Persisted cache (localStorage)**
- Add `@tanstack/react-query-persist-client` + `@tanstack/query-sync-storage-persister`.
- Wrap `QueryClientProvider` with `PersistQueryClientProvider`.
- `maxAge: 24h`, `buster` keyed to app version (already exposed via `useAppVersionCheck`) so a deploy invalidates everything.
- **Tenant/user safety**: a `dehydrateOptions.shouldDehydrateQuery` filter excludes any query whose key contains `auth`, `secret`, or `chrome-extension`. On `signOut` and on tenant switch in `OrgContext`, call `queryClient.clear()` AND `persister.removeClient()` so cached data never crosses identities.

**4. Hot-path hook tuning (~15 hooks)**
Apply explicit tiers + canonical query keys on the highest-traffic hooks:
- `useDashboardLayout`, dashboard widget hooks (agenda, upcoming activities, recruiting ops) → `reference`
- `useAnalyticsMetrics`, `useJobAnalyticsMetrics`, `useAnalyticsFilterOptions` → `reference` / `static`
- `useCandidates`, `useIndependentCandidates`, `useCandidateAssociations`, `useCandidateJobAssociations` → `transactional`
- `useCandidateFilterOptions`, `useApplicationFields`, `useCandidateSources` → `static`
- `useCustomerMembers`, members list query → `reference`
- `useAutocompleteSearch` → keep its existing debounce; add `staleTime: 5min` per query string
- `useBookingAvailability`, `useBookingConfig`, `useBookingEventTypes` → `reference`
- `useCalendarIdentities` → `reference`

**5. Canonical query keys**
Introduce `src/lib/cache/queryKeys.ts` with factories:
```ts
qk.candidates.list(tenantId, filters)
qk.candidates.byId(id)
qk.jobs.list(tenantId)
qk.dashboard.widgets(tenantId, userId)
qk.analytics.metrics(tenantId, range)
qk.members.list(tenantId)
```
Existing hooks migrate one by one (no big-bang rewrite). Mutations use the same factory to invalidate predictably.

**6. Invalidation contract**
- Documented in `src/lib/cache/README.md` + saved as a memory.
- Each mutation hook lists the keys it invalidates. Examples:
  - Move candidate stage → invalidate `qk.candidates.list`, `qk.dashboard.widgets`, the affected job's pipeline.
  - Edit member role → invalidate `qk.members.list`, `qk.dashboard.widgets`.
  - Create/update job → invalidate `qk.jobs.list`, related analytics, dashboard.
- For 5–15 min cached widgets we also expose a manual "Refresh" affordance on dashboard widgets via existing dropdown (calls `queryClient.invalidateQueries({ queryKey: qk.dashboard.widgets() })`).

**7. Verification**
- Reload `/dashboard`, open Network tab: confirm second navigation to Dashboard issues 0 Supabase calls within `staleTime`.
- Hard reload after first visit: confirm widgets paint from cache instantly while a single background revalidation runs.
- Sign out → sign in as a different tenant: confirm zero cache leakage (cleared on sign-out).
- Move a candidate on the pipeline: confirm dashboard widgets reflect the change after invalidation.

---

### Out of scope (for this pass)
- Edge-function / server-side caching (analytics, AI fit insights). Saved for a "Full overhaul" follow-up.
- Touching the remaining ~80 cold-path hooks — they inherit the new global defaults automatically and can be tuned later.
- Realtime (Supabase channels) replacing polling — separate initiative.

### Files touched (estimate)
- New: `src/lib/cache/cacheTiers.ts`, `src/lib/cache/queryKeys.ts`, `src/lib/cache/persister.ts`, `src/lib/cache/README.md`
- Edited: `src/App.tsx`, `src/contexts/AuthContext.tsx` (sign-out clear), `src/contexts/OrgContext.tsx` (tenant-switch clear), ~15 hot-path hooks
- Memory: update `core-data-sync-architecture` to point at the new cache tiers + invalidation contract
- Dependencies: `@tanstack/react-query-persist-client`, `@tanstack/query-sync-storage-persister`

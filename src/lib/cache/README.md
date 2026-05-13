# Cache contract

This app uses **react-query** as its single source of truth for server data.
Caching is intentional, tiered, and persisted across reloads.

## Tiers (`src/lib/cache/cacheTiers.ts`)

| Tier | staleTime | gcTime | Use for |
|---|---|---|---|
| `realtime` | 0 | 5 min | Mutation read-after-write, active kanban board |
| `transactional` | 60s | 10 min | Candidate lists, job lists, scorecards |
| `reference` | 10 min | 60 min | Dashboard widgets, analytics, members |
| `static` | 60 min | 24 h | Filter options, app fields, integration registry |

Spread into a query:
```ts
useQuery({ ...cacheTiers.reference, queryKey: qk.dashboard.widgets(tenantId), queryFn })
```

## Global defaults (`src/App.tsx`)
- `staleTime: 60s` (transactional default for unclassified queries)
- `gcTime: 10 min`
- `refetchOnWindowFocus: false`
- `refetchOnReconnect: 'always'`
- `retry: 1`

## Persistence (`src/lib/cache/persister.ts`)
- Cache is persisted to `localStorage` under `virgilio.rq-cache.v1`.
- `maxAge: 24h`. Bump `CACHE_VERSION` when shape changes.
- Sensitive keys (`auth`, `secret`, `chrome-extension`, `session`) are never persisted.
- On sign-out and tenant switch the persisted cache is wiped to prevent cross-identity leakage.

## Query keys (`src/lib/cache/queryKeys.ts`)
Use the `qk` factory for all hot-path hooks. Mutations invalidate via the same factory:
```ts
queryClient.invalidateQueries({ queryKey: qk.candidates.all })
```

## Invalidation contract
- **Move candidate stage** → invalidate `qk.candidates.all`, `qk.dashboard.all`.
- **Edit member role** → invalidate `qk.members.all`, `qk.dashboard.all`.
- **Create/update job** → invalidate `qk.jobs.all`, `qk.analytics.all`, `qk.dashboard.all`.
- **Save dashboard layout** → invalidate `qk.dashboard.layout(userId)`.
- Cache-aggressive widgets (10 min `reference` tier) expose a manual refresh
  via the existing widget dropdown.

## Adding a new query
1. Pick a tier. Default to `transactional` if unsure.
2. Add a key factory under `qk` if the data is shared across components.
3. List its invalidators (which mutations should bust it) in the relevant hook.

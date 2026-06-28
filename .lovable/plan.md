# Fix Analytics crash on `/analytics`

## Root cause

`useCrmAnalyticsMetrics` returns `Map` instances (`ownerMap`, `companyMap`, `stageMap`) from its react-query `queryFn`. The app's react-query cache persister serializes cached query data to JSON. `Map` does not survive `JSON.stringify` — it becomes an empty plain object `{}`. On rehydration (or on any code path that round-trips through the persisted cache), `labelMap.has(k)` at line 242 of `useCrmAnalyticsMetrics.ts` throws `TypeError: r.has is not a function`, which is exactly the production stack we see. The same risk applies to `buildBreakdown` calls that pass these maps in.

The Supabase realtime websocket close and the `profiles` 400 in the console are unrelated noise (the websocket teardown happens because the React tree unmounts when the ErrorBoundary catches the crash; the profiles 400 is a separate RLS issue and isn't what's breaking the page).

## Fix

Refactor `src/hooks/analytics/useCrmAnalyticsMetrics.ts` so the query result holds only serializable primitives, and rebuild the `Map`s inside `useMemo`:

1. In `queryFn`, replace the three `Map` instances with plain arrays of `{ id, label }` (or for stages, keep the existing `StageMeta[]` and derive label inline). Return:
   ```
   { tenantId, deals, payments, stages,
     owners: [{ id, label }],
     companies: [{ id, name }] }   // stageMap derived from stages
   ```
   No `Map` instances in the returned object.
2. In the `useMemo` block, construct fresh `Map`s from those arrays before calling `buildBreakdown`:
   ```
   const ownerMap = new Map(owners.map(o => [o.id, o.label]))
   const companyMap = new Map(companies.map(c => [c.id, c.name]))
   const stageMap = new Map(stages.map(s => [s.id, s.name]))
   ```
3. Leave `sourceLabels` as-is (it's already built inside `useMemo`).
4. No behavioral changes to `computeValues` / `buildBreakdown` / trend logic.

## Verification

- Reload `/analytics` (and `/crm/overview`) — page renders without ErrorBoundary; KPI/funnel/line widgets populate.
- Hard-refresh after navigating away and back to confirm the persisted cache path also works.
- Check console — the `TypeError: r.has is not a function` no longer appears.

## Out of scope

- The `profiles?...` 400 (likely RLS on `profiles` for cross-tenant owner IDs). Separate ticket if it still surfaces after this fix; it does not cause the crash.
- The realtime websocket message (symptom of unmount, not a bug here).

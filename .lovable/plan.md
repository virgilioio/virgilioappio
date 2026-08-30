# Fix Dashboard crash: `b.has is not a function` from persisted react-query Set

## Problem
`useQueueDismissals` returns a `Set` as react-query query data. The app persists the query cache to localStorage as JSON (`PersistQueryClientProvider` + sync persister). A `Set` round-trips through JSON as a plain object `{}`, so after a reload `dismissed` has no `.has()` and Dashboard.tsx:249 crashes inside the ErrorBoundary. Anyone with a persisted cache from a previous session hits this.

## Fix — `src/hooks/useQueueDismissals.ts` only

1. **JSON-safe query data.** Change the queryFn to return `string[]` of `item_key` values instead of a `Set`, and set the query's `initialData`/default to an empty array.
2. **Derive the Set for consumers.** `const dismissed = useMemo(() => new Set(dismissedKeys ?? []), [dismissedKeys])`. The public return shape is unchanged — still `{ dismissed: Set<string>, isLoading, toggle }` — so Dashboard.tsx needs no edits.
3. **Optimistic updates operate on the array.** The `setLocal` helper and the `onMutate`/`onError` handlers in `dismiss` and `undo` produce a new deduplicated array (`[...prev, key]` / `prev.filter(...)`), never a Set.
4. **Legacy-cache guard.** When reading previous query data in `setQueryData`, coerce non-array values (an old persisted `{}` or any stale shape) to `[]` before applying the mutation, so users with a poisoned cache recover on next load instead of crashing. The derived-Set step also guards with `Array.isArray` so a stale persisted value can never reach consumers as a non-Set.

No changes to Dashboard.tsx, the persister config, `PersistQueryClientProvider`, the `dashboard_queue_dismissals` table, or any other hook.

## Same bug class elsewhere — found during audit (report only, no changes)

Searched all `src/hooks` for `new Set(` / `new Map(` / bare `Date` returned as queryFn data while persistence is on. Three real instances:

| Hook | What the queryFn returns | Risk |
|---|---|---|
| `src/hooks/useUserAssignedJobIds.ts:30` | `Set<string>` of job IDs | Same crash class: after a reload, `assignedJobIds.has()` throws for any caller |
| `src/hooks/useRecruiterUserIds.ts:26` | `Set<string>` of user IDs | Already guarded — line 32 coerces non-Set data back to a Set (`data instanceof Set ? data : new Set(...)`), so it self-heals on load |
| `src/hooks/useValidationPointResolutions.ts:38-74` | `Map<number, ValidationPointResolution>` | Same crash class; it has a `toMap` coerce helper (line 21) but the queryFn itself still returns a Map, so any consumer reading raw query data post-reload gets `{}` |

Recommend a follow-up pass converting these two unguarded hooks (`useUserAssignedJobIds`, `useValidationPointResolutions`) to the same array-in-cache / derive-Set-or-Map-with-useMemo pattern. Not changing them in this fix.

## Verify
- Typecheck/build pass.
- Manually confirm: dismiss a queue item, reload the page, Dashboard renders without crashing and the dismissed item stays dismissed.

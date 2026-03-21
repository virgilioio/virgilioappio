

# Fix: Search Criteria Values Lost on Add/Select

## Root Cause

**`src/pages/Find.tsx` line 109** — `handleCriteriaChange` drops updates when `editableCriteria` is null:

```ts
setEditableCriteria(prev => prev ? { ...prev, ...updates } : null)
//                                                           ^^^^
//                                         update silently discarded
```

This happens when `currentProject.search_criteria` is null/undefined in the DB, or during the brief window between project load and criteria sync. The filter panel renders fine (using `EMPTY_CRITERIA` fallback), but every `onAdd` call goes into a black hole.

## Fix

**`src/pages/Find.tsx`** — One line change in `handleCriteriaChange`:

When `prev` is null, initialize from the `EMPTY_CRITERIA` defaults instead of returning null:

```ts
const handleCriteriaChange = useCallback((updates: Partial<SearchCriteria>) => {
  setEditableCriteria(prev => {
    const base = prev || {
      skills: [], title_keywords: [], keywords: [], locations: [],
      seniorities: [], company_sizes: [], industries: [],
      company_names: [], experience_years: {},
    }
    return { ...base, ...updates }
  })
}, [])
```

This ensures that even if `editableCriteria` starts as null, the first user interaction creates a proper criteria object with the user's input preserved.

## Files

| File | Change |
|------|--------|
| `src/pages/Find.tsx` | Fix `handleCriteriaChange` to initialize from defaults when prev is null |


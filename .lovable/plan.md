

# Fix: Saved View Selected But Filters Not Applied

## Root Cause

In `IndependentCandidateTable.tsx` (line 222-231), when restoring from sessionStorage on mount:

```typescript
const storedViewId = getActiveViewId()
if (storedViewId) {
  setActiveViewId(storedViewId)  // ← Only sets the UI label
  // ← NEVER applies the view's filters!
}
```

The view appears selected visually, but `setFiltersFromRecord` is never called with the view's saved filters. The `usePersistentFilters` hook does separately restore filters from sessionStorage, but if the session was lost or filters were empty when stored, the view shows as active with no filters applied.

## Fix

When a `storedViewId` is found, look up the matching view from the loaded `views` list and apply its filters. This requires using `views` (not just `defaultView`) from `useSavedViews`.

## Files changed

| File | Change |
|------|--------|
| `src/components/candidates/IndependentCandidateTable.tsx` | (1) Destructure `views` from `useSavedViews('candidates')` alongside `defaultView`. (2) In the mount `useEffect`, when `storedViewId` is found, look up the view in `views` and call `setFiltersFromRecord(view.filters)`. Add `views` to the dependency considerations so the effect re-runs when views finish loading. |

## Updated logic

```typescript
const { views, defaultView } = useSavedViews('candidates')

useEffect(() => {
  const storedViewId = getActiveViewId()
  if (storedViewId) {
    setActiveViewId(storedViewId)
    const matchedView = views.find(v => v.id === storedViewId)
    if (matchedView) {
      setFiltersFromRecord(matchedView.filters as Record<string, unknown>)
    }
  } else if (defaultView) {
    setActiveViewId(defaultView.id)
    setFiltersFromRecord(defaultView.filters as Record<string, unknown>)
  }
}, [defaultView?.id, views.length])
```

This ensures that whenever a saved view is marked as active, its filters are actually applied — both on initial load and when restoring from session.


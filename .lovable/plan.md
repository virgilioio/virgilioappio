

# Fix: Guard against undefined `salaryValues`

**Problem**: `CompensationInsights` crashes at line 100 because `salaryValues` is `undefined` when the data hook hasn't resolved yet or returns no salary data.

**Fix**: Add a default empty array fallback in the `useMemo` guard at line 100 of `src/components/talent-insights/CompensationInsights.tsx`:

```ts
// Line 100, change:
if (salaryValues.length < 3) return null
// to:
if (!salaryValues || salaryValues.length < 3) return null
```

Single-line change, no other files affected.


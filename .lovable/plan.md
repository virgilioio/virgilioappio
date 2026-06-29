## Problem
Validated. In `src/pages/Dashboard.tsx` the `EmptyQueue` component (line 671) is hand-rolled:

```tsx
<div style={{ padding: '48px 16px', textAlign: 'center' }}>
  <CheckCircle2 .../>
  <div>All clear — nothing needs you right now.</div>
</div>
```

This violates the canonical empty-state rule (`mem://style/ui/standardized-empty-states` + `EmptyState` primitive in `src/components/ui/empty-state.tsx`): "Never hand-roll empty blocks. Always use `<EmptyState>`."

## Fix

Replace `EmptyQueue` with the canonical `<EmptyState>` primitive using the inline (card) variant and the standard Gio mascot illustration, so it matches other in-card empties across the app (Analytics, Today card, etc.).

### Change in `src/pages/Dashboard.tsx`

1. Add imports:
   - `import { EmptyState } from '@/components/ui/empty-state'`
   - `import { SoftPlane } from '@/components/ui/EmptyIllustrations'` (calm, generic "all clear" scene already used by `GioEmptyState`)

2. Replace the `EmptyQueue` function body with:

```tsx
function EmptyQueue() {
  return (
    <div style={{ padding: '16px' }}>
      <EmptyState
        size="card"
        illustration={<SoftPlane />}
        title="All clear"
        body="Nothing needs you right now — new scorecards, decisions, replies and applications will appear here."
      />
    </div>
  )
}
```

3. Filtered variant (nice-to-have, scoped to same card): when the user has selected a chip (e.g. "Scorecards") and there are 0 matching items but the overall queue is non-empty, show a filtered message instead. Implementation: pass `filter` and `counts.all` into `EmptyQueue` and branch:

```tsx
{loading
  ? <QueueSkeleton />
  : items.length === 0
    ? <EmptyQueue filter={filter} totalAll={counts.all} onClear={() => onFilter('all')} />
    : (...)}
```

`EmptyQueue` then renders either the "All clear" variant (when `totalAll === 0`) or a filtered variant using `SoftMagnifier` with title "No matches" + a "Clear filter" `EmptyAction` that calls `onClear`.

4. Remove the now-unused `CheckCircle2` import if it isn't referenced elsewhere in the file (verify before deleting).

## Out of scope
- No changes to queue data fetching, row rendering, skeleton, or the Today card.
- No design-token or layout changes elsewhere.

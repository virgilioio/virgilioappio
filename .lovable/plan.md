

# Fix: Dashboard Goes Blank When Calendar Expands

## Root Cause

The `ResizeObserver` callback in `MasonryGrid.tsx` (line 43) captures a **stale closure** over `heights`. When any widget resizes (e.g., calendar expanding), the observer fires and builds `new Map(heights)` — but `heights` is frozen at the value from when the effect was created (only re-runs when item IDs change). This means the updated map overwrites current heights with stale values, corrupting the layout and making widgets invisible.

## Fix

Replace `new Map(heights)` with `setHeights(prev => ...)` — the functional updater pattern. This ensures the callback always works with the latest state, regardless of when the effect was created.

### `src/components/dashboard/MasonryGrid.tsx` — Lines 40-55

**Before:**
```typescript
const observer = new ResizeObserver((entries) => {
  let changed = false
  const newHeights = new Map(heights)        // ← stale closure
  for (const entry of entries) { ... }
  if (changed) setHeights(newHeights)
})
```

**After:**
```typescript
const observer = new ResizeObserver((entries) => {
  const updates = new Map<string, number>()
  for (const entry of entries) {
    const el = entry.target as HTMLElement
    const id = el.dataset.masonryId
    if (!id) continue
    const h = entry.borderBoxSize?.[0]?.blockSize ?? el.offsetHeight
    updates.set(id, h)
  }
  if (updates.size > 0) {
    setHeights(prev => {
      const next = new Map(prev)             // ← always fresh
      let changed = false
      for (const [id, h] of updates) {
        if (next.get(id) !== h) { next.set(id, h); changed = true }
      }
      return changed ? next : prev
    })
  }
})
```

This is a single-file, ~15-line change. No other files affected.

| File | Change |
|------|--------|
| `src/components/dashboard/MasonryGrid.tsx` | Fix stale closure in ResizeObserver callback using functional state updater |


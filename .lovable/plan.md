

# Fix: "Cannot read properties of undefined (reading 'size')" in Dashboard

## Root Cause

During drag-and-drop, `onDragOver` calls `reorderWidgets` which updates the `widgets` state. On the next render, `renderableWidgets` is recomputed from the new state, but `placements` is also recomputed — and during rapid drag events, there can be a moment where a placement references a widget ID that `renderableWidgets.find()` returns `undefined` for.

The `widget?.size ?? 'small'` fallback on line 202 should handle this, but the error at "line 523" in the bundled code suggests a different `.size` access path — likely inside `renderCard` where `widgetSizeMap[id]` is used, or possibly the `WIDGET_REGISTRY[id].fixed` access on line 210 when `id` comes from a stale placement.

## Fix

### `src/pages/Dashboard.tsx` — Guard all ID lookups in renderCustomizeGrid

1. **Filter placements to only valid IDs**: Add a filter after computing placements to ensure every placement ID exists in `renderableWidgets`
2. **Guard the `WIDGET_REGISTRY[id].fixed` access** on line 210 with optional chaining: `WIDGET_REGISTRY[id]?.fixed`
3. **Skip rendering if widget not found**: Add an early return in the `.map()` callback

```typescript
// Line ~200, inside renderCustomizeGrid
{placements
  .filter(({ id }) => renderableWidgets.some(w => w.id === id))
  .map(({ id }) => {
    const widget = renderableWidgets.find(w => w.id === id)
    if (!widget) return null
    const widgetSize = widget.size
    return (
      <div key={id} className="min-w-0">
        <DraggableDashboardCard
          id={id}
          isCustomizing
          currentSize={widgetSize}
          onHide={() => hideCard(id)}
          onCycleSize={!WIDGET_REGISTRY[id]?.fixed ? () => cycleWidgetSize(id) : undefined}
        >
          {renderCard(id)}
        </DraggableDashboardCard>
      </div>
    )
  })}
```

### Files changed

| File | Change |
|------|--------|
| `src/pages/Dashboard.tsx` | Add guard filter + null checks in both `renderCustomizeGrid` and `renderNormalGrid` placement maps |


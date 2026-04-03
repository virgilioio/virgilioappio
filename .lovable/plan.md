
# Where We Are vs. The Utopian Dashboard

## What's working well
- Customize mode entry/exit feels intentional and mature
- Drag overlay with lift + shadow + rotation feels premium
- Drop position indicator (before/after line) is present
- Masonry packing eliminates vertical gaps
- Persistence, resize cycling, hide/show all solid

## The one remaining problem — and why it keeps happening

**Root cause**: `moveWidgetBefore` and `moveWidgetAfter` use **splice-based array reordering**. They remove the dragged widget from the array, then insert it at the target position. This shifts the `order` of every widget between the old and new positions. When `computePlacements` re-packs from the new order, multiple widgets get new grid positions — the "running away" effect.

**Example**: Widgets in order: [Tasks(0), Agenda(1), Clock(2), AppReview(3), Onboarding(4), Jobs(5)].
User drags Jobs to place it after Tasks. `moveWidgetAfter` produces: [Tasks(0), Jobs(1), Agenda(2), Clock(3), AppReview(4), Onboarding(5)]. Agenda, Clock, AppReview, Onboarding ALL got new order values. The packer re-places ALL of them. Everything shifts.

**The fix**: Instead of splice-reorder, use a **targeted swap** — only exchange the order values of the dragged widget and the target widget. Every other widget keeps its exact order value. The packer then only changes the positions of those two widgets.

For "insert before" — swap the dragged widget's order with the target's order.
For "insert after" — swap the dragged widget's order with the target's order.

Since the masonry packer is deterministic and order-based, swapping exactly two order values means exactly two widgets change position. Everything else stays put.

## Changes

### 1. `src/hooks/useDashboardLayout.ts` — Replace splice reorder with swap

Replace `moveWidgetBefore` and `moveWidgetAfter` with a single `swapWidgetOrder` function:

```typescript
const swapWidgetOrder = useCallback((activeId: string, targetId: string) => {
  setWidgets(prev => {
    const active = prev.find(w => w.id === activeId)
    const target = prev.find(w => w.id === targetId)
    if (!active || !target || active.order === target.order) return prev
    return prev.map(w => {
      if (w.id === activeId) return { ...w, order: target.order }
      if (w.id === targetId) return { ...w, order: active.order }
      return w
    }).sort((a, b) => a.order - b.order)
  })
}, [])
```

Export `swapWidgetOrder` instead of `moveWidgetBefore`/`moveWidgetAfter`.

### 2. `src/pages/Dashboard.tsx` — Use swap in handleDragEnd

Replace the before/after branching with a single swap call:

```typescript
const handleDragEnd = (event: DragEndEvent) => {
  const { active, over } = event
  if (over && active.id !== over.id) {
    swapWidgetOrder(String(active.id), String(over.id))
  }
  setActiveId(null)
  setDropTarget(null)
  finalizeLayout()
}
```

The `dropTarget` position indicator (before/after line) stays for visual feedback during drag — it still shows the user where they're aiming. But the actual mutation is always a swap, which preserves all other widgets' positions.

## Why this finally solves it

- Splice reorder: N widgets change order → N widgets re-placed → cascade
- Swap: 2 widgets change order → 2 widgets re-placed → stable

The dragged widget takes the target's position. The target takes the dragged widget's old position. Nothing else moves.

## Files changed

| File | Change |
|------|--------|
| `src/hooks/useDashboardLayout.ts` | Replace `moveWidgetBefore`/`moveWidgetAfter` with `swapWidgetOrder` |
| `src/pages/Dashboard.tsx` | Use `swapWidgetOrder` in `handleDragEnd`, remove before/after branching |

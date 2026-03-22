

# Fix Pipeline Kanban Drag-and-Drop: Horizontal Scroll + Full Page Refresh

## Problems

### 1. Horizontal scroll during drag
The board container (line 596) has `overflow-x-auto`. When a card is dragged, `CSS.Translate` moves it within the scrollable container, causing the stage column to scroll horizontally as the card shifts position. The `DropZone` expanding from `h-0` to `h-16` also pushes sibling cards, creating visible content shifting.

### 2. Full re-render on drop
`onDragEnd` (line 282-326) calls `await loadPipeline()` after every move — this re-fetches ALL candidates from the server and replaces all state, causing a full flash/re-render instead of a smooth transition. There's no optimistic update.

## Fixes

### Fix 1: Prevent horizontal scroll during drag

**`src/components/jobs/DraggableCandidateCard.tsx`**
- When `isDragging` is true, the source element should collapse to `height: 0, overflow: hidden, margin: 0, padding: 0` so it doesn't take up space or affect scroll. This prevents the "gap" from pushing content.

**`src/components/jobs/DropZone.tsx`**
- Remove the `h-16` expansion for non-empty stages — this is what causes sibling cards to jump. Instead, use a subtle border/highlight on the stage column itself to indicate it's a valid drop target (no height change = no content shift).

### Fix 2: Optimistic state update on drop

**`src/components/jobs/PipelineOverview.tsx`** — `onDragEnd` callback
- Before calling the server, immediately update `byStage` state: remove the association from its source stage and add it to the target stage
- Then call `moveAssociationToStage` in the background (no `await`)
- Only call `loadPipeline()` if the server call fails (to revert)
- This gives instant visual feedback — the card appears in the new column immediately

```tsx
const onDragEnd = useCallback(async (event: DragEndEvent) => {
  const { active, over } = event
  setActiveId(null)
  if (!over) return
  
  const assocId = String(active.id)
  const toStageId = String(over.id)
  const entry = assocMap.get(assocId)
  if (!entry || entry.stageJhsId === toStageId) return
  
  // Optimistic update: move card in local state
  setByStage(prev => {
    const next = { ...prev }
    // Remove from source
    next[entry.stageJhsId] = (next[entry.stageJhsId] || []).filter(a => a.id !== assocId)
    // Add to target
    next[toStageId] = [...(next[toStageId] || []), { ...entry.assoc, current_stage_id: toStageId }]
    return next
  })
  
  // Server sync in background
  try {
    await moveAssociationToStage(assocId, toStageId)
    // Silently refresh to sync any server-side changes
    loadPipeline()
  } catch {
    // Revert on failure
    loadPipeline()
    toast({ title: 'Error', description: 'Failed to move candidate.', variant: 'destructive' })
  }
}, [...])
```

For bulk moves, same pattern — optimistically move all selected cards.

## Files

| File | Change |
|------|--------|
| `src/components/jobs/DraggableCandidateCard.tsx` | Collapse source element when dragging (height:0) instead of just opacity:0, preventing scroll shifts |
| `src/components/jobs/DropZone.tsx` | Remove height expansion for non-empty stages; use border/bg highlight only |
| `src/components/jobs/PipelineOverview.tsx` | Optimistic `byStage` state update in `onDragEnd` before server call; background sync |


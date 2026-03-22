

# Smooth Drag-and-Drop Audit & Improvements

## Current Issues Found

Six DnD implementations across the app, all with similar problems:

1. **No `DragOverlay` on sortable lists** — HiringPlanTab, OfferApprovalChainConfig, InterviewQuestionsList drag the actual DOM node, causing layout reflows and content jumping as the item leaves document flow
2. **`CSS.Transform` instead of `CSS.Translate`** — Sortable items use `CSS.Transform.toString()` which includes scale transforms from the sorting algorithm, causing size flicker. Should use `CSS.Translate.toString()` for position-only movement
3. **PipelineOverview (Kanban)** — DraggableCandidateCard applies rotation/scale on the source element AND the DragOverlay, creating redundant transforms. Source should just hide cleanly
4. **No smooth drop animation** — Missing `dropAnimation` config on DragOverlay for a polished settle effect
5. **Activation constraints inconsistent** — Some use PointerSensor with no distance threshold, causing accidental drags on click

## Fixes

### 1. `src/components/jobs/DraggableCandidateCard.tsx`
- Remove rotation/scale from the source element transform — only apply `CSS.Translate.toString(transform)`
- Source element should just go `opacity: 0` when dragging (the DragOverlay handles the visual)
- Remove unnecessary `transition` on transform (causes lag following the cursor)

### 2. `src/components/jobs/DraggableStageItem.tsx`
- Switch from `CSS.Transform.toString()` to `CSS.Translate.toString()` to avoid scale flicker
- When `isDragging`, set `opacity: 0` (placeholder stays in flow, overlay shows the visual)

### 3. `src/components/jobs/HiringPlanTab.tsx`
- Add `DragOverlay` with a rendered clone of the active stage item
- Track `activeId` on `onDragStart` (already done), render overlay content
- Add `dropAnimation` with `{ duration: 200, easing: 'ease' }`

### 4. `src/components/jobs/OfferApprovalChainConfig.tsx`
- Same pattern: add `DragOverlay` with clone of active approver step
- Switch `CSS.Transform` → `CSS.Translate` in `SortableApproverItem`
- Add activation constraint `{ distance: 5 }` to PointerSensor

### 5. `src/components/jobs/stage-config/InterviewQuestionsList.tsx`
- Add `DragOverlay` with clone of active question
- Switch `CSS.Transform` → `CSS.Translate` in `SortableQuestionItem`
- Set `opacity: 0` on source when dragging (already has `opacity-50`, change to `opacity-0`)

### 6. `src/components/settings/OfferFormFieldsManager.tsx`
- Switch `CSS.Transform` → `CSS.Translate` in `SortableFieldRow`
- Already has DragOverlay — good. Just fix the transform type

### 7. `src/components/jobs/postings/PostingFieldsBuilder.tsx`
- Already has DragOverlay — good. Verify transform type in `SortableRow`

### 8. `src/components/jobs/PipelineOverview.tsx`
- Add `dropAnimation` config to existing `DragOverlay`: `{ duration: 200, easing: 'ease' }`
- Add `modifiers={[restrictToWindowEdges]}` to prevent dragging cards off screen

## Summary of pattern applied everywhere

```text
Source item:  CSS.Translate (not Transform), opacity: 0 when dragging
DragOverlay:  Clone of item with shadow + slight rotation, dropAnimation config
Sensors:      PointerSensor { distance: 5-10 }, TouchSensor { delay: 150 }
```

## Files

| File | Change |
|------|--------|
| `src/components/jobs/DraggableCandidateCard.tsx` | Simplify to translate-only + opacity:0; remove rotation/scale from source |
| `src/components/jobs/DraggableStageItem.tsx` | CSS.Translate; opacity:0 when dragging |
| `src/components/jobs/HiringPlanTab.tsx` | Add DragOverlay with clone + dropAnimation |
| `src/components/jobs/OfferApprovalChainConfig.tsx` | Add DragOverlay; CSS.Translate; activation constraint |
| `src/components/jobs/stage-config/InterviewQuestionsList.tsx` | Add DragOverlay; CSS.Translate; opacity:0 |
| `src/components/settings/OfferFormFieldsManager.tsx` | CSS.Translate fix |
| `src/components/jobs/postings/PostingFieldsBuilder.tsx` | CSS.Translate fix if needed |
| `src/components/jobs/PipelineOverview.tsx` | Add dropAnimation + restrictToWindowEdges modifier |




# Add Drag-and-Drop Reordering to Offer Approval Chain

Replace the up/down chevron buttons with drag-and-drop reordering, consistent with HiringPlanTab and InterviewQuestionsList.

## Changes

### 1. `src/hooks/useOfferApprovalChain.ts`
- Add a new `reorderStepsMutation` that accepts a full ordered array of step IDs and bulk-updates `step_order` values in Supabase.
- Expose `reorderSteps(orderedIds: string[])` from the hook.

### 2. `src/components/jobs/OfferApprovalChainConfig.tsx`
- Import `DndContext`, `closestCenter`, `PointerSensor`, `useSensor`, `useSensors`, `DragEndEvent` from `@dnd-kit/core`.
- Import `SortableContext`, `verticalListSortingStrategy`, `arrayMove` from `@dnd-kit/sortable`.
- Create a `SortableApproverItem` sub-component using `useSortable` — includes a `GripVertical` drag handle, the existing step number circle, name, email, role badge, and trash button.
- Wrap the steps list in `DndContext` + `SortableContext`.
- On `handleDragEnd`, compute the new order with `arrayMove` and call `reorderSteps`.
- Remove the `ChevronUp`/`ChevronDown` buttons and the `reorderApprover` import entirely.

Follows the exact same pattern as `InterviewQuestionsList.tsx`: `GripVertical` handle, `useSortable`, `CSS.Transform`, `isDragging && 'opacity-50'`.




# DnD Polish Pass — Unified Interaction Language

## Audit: All DnD Surfaces Found

| # | Surface | File | Type | Sensors | DragOverlay | Source Behavior | Overlay Style |
|---|---------|------|------|---------|-------------|-----------------|---------------|
| 1 | Pipeline Kanban | `PipelineOverview.tsx` + `DraggableCandidateCard.tsx` + `DroppableStage.tsx` + `DropZone.tsx` | Draggable → Droppable | Mouse(10px) + Touch(180ms) | Yes, with bulk stack | Collapse (h:0) | rotate(-2deg) scale(1.02) shadow |
| 2 | Hiring Plan stages | `HiringPlanTab.tsx` + `DraggableStageItem.tsx` | Sortable list | Pointer(5px) + Keyboard | Yes | opacity:0 | rotate(-2deg) scale(1.02) shadow |
| 3 | Offer Approval Chain | `OfferApprovalChainConfig.tsx` | Sortable list | Pointer(5px) | Yes | opacity:0 (+ conflicting `opacity-50` class) | rotate(-1deg) scale(1.02) shadow |
| 4 | Interview Questions | `InterviewQuestionsList.tsx` | Sortable list | Pointer(5px) + Keyboard | Yes | opacity:0 (+ conflicting `opacity-50` class) | rotate(-1deg) scale(1.02) shadow |
| 5 | Offer Form Fields | `OfferFormFieldsManager.tsx` | Sortable list | Pointer(5px) | Yes (minimal: label+type) | opacity:0 | No rotation, just shadow-lg w-[280px] |
| 6 | Posting Fields | `PostingFieldsBuilder.tsx` | Sortable + DropBox zones | Pointer(5px) | Yes (minimal: label+type) | opacity:0 | No rotation, just shadow-lg w-[280px] |

## Inconsistencies Found

1. **Overlay rotation**: Kanban uses -2deg, approval/questions use -1deg, form fields use 0deg
2. **Shadow style**: Mixed between inline `boxShadow` and Tailwind `shadow-lg`
3. **Source opacity**: Some use `opacity: 0` via style, but also have `opacity-50` in className (conflicting — e.g., InterviewQuestionsList line 107, OfferApprovalChainConfig line 79)
4. **Drop animation**: Kanban + HiringPlan + Approval + Questions have `dropAnimation: { duration: 200, easing: 'ease' }`, but OfferFormFieldsManager and PostingFieldsBuilder DragOverlays have NO dropAnimation
5. **Touch sensor**: Only PipelineOverview has TouchSensor; all sortable lists lack it
6. **Keyboard sensor**: Only HiringPlanTab and InterviewQuestionsList have KeyboardSensor; others don't
7. **DropZone**: Only used in kanban; no visual drop indicator for sortable lists
8. **Cursor**: DraggableCandidateCard sets `cursor: grab`; sortable items use `cursor-grab` class on handle only; no `active:cursor-grabbing` on some

## Unified Design Language

**Overlay**: `rotate(-1.5deg) scale(1.03)`, shadow `0 12px 24px rgba(0,0,0,0.15)` — consistent everywhere
**Source**: `opacity: 0` (style only, no conflicting classes)
**Drop animation**: `{ duration: 200, easing: 'ease' }` everywhere
**Sensors**: All get Pointer(5px) + Touch(180ms, 8px tolerance). Keyboard where already present stays.
**Drag handle**: `cursor-grab active:cursor-grabbing` on all handles
**Transition on source**: `transition` from dnd-kit only, no extra CSS transition that lags behind cursor

## Changes

### 1. `src/components/jobs/DraggableCandidateCard.tsx`
- Remove `transition: 'transform 200ms ease, opacity 150ms ease'` from non-dragging style (this causes lag following cursor during drag initiation)
- Keep collapse behavior (h:0) for kanban source — this is correct for cross-container drag
- Keep `cursor: 'grab'`

### 2. `src/components/jobs/DraggableStageItem.tsx`
- Remove conflicting `showDragging && "shadow-lg z-10"` class (overlay handles the visual)
- Ensure opacity:0 is the only visual change when dragging

### 3. `src/components/jobs/PipelineOverview.tsx`
- Unify overlay style to `rotate(-1.5deg) scale(1.03)`, shadow `0 12px 24px rgba(0,0,0,0.15)`

### 4. `src/components/jobs/HiringPlanTab.tsx`
- Unify overlay style from `rotate(-2deg) scale(1.02)` to `rotate(-1.5deg) scale(1.03)`, shadow `0 12px 24px rgba(0,0,0,0.15)`
- Add TouchSensor

### 5. `src/components/jobs/OfferApprovalChainConfig.tsx`
- Remove conflicting `isDragging && 'opacity-50'` from className (line 79) — style `opacity: 0` already handles it
- Unify overlay style from `rotate(-1deg) scale(1.02)` to `rotate(-1.5deg) scale(1.03)`
- Add TouchSensor

### 6. `src/components/jobs/stage-config/InterviewQuestionsList.tsx`
- Remove conflicting `isDragging && 'opacity-50 shadow-lg'` from className (line 107) — style `opacity: 0` already handles it
- Unify overlay style from `rotate(-1deg) scale(1.02)` to `rotate(-1.5deg) scale(1.03)`
- Add TouchSensor

### 7. `src/components/settings/OfferFormFieldsManager.tsx`
- Add `dropAnimation={{ duration: 200, easing: 'ease' }}` to DragOverlay
- Add overlay rotation/shadow to match system: wrap content in div with unified style
- Add TouchSensor

### 8. `src/components/jobs/postings/PostingFieldsBuilder.tsx`
- Add `dropAnimation={{ duration: 200, easing: 'ease' }}` to DragOverlay
- Add overlay rotation/shadow to match system
- Add TouchSensor

### 9. `src/components/jobs/DropZone.tsx`
- Refine the transition for empty columns: use `duration-250` for slightly smoother expansion

## What stays untouched
- All drag logic, reorder logic, persistence, optimistic updates
- Selection behavior, bulk drag logic, counts, filters
- Stage rules, permissions, business logic
- Kanban collapse-on-drag behavior (correct for cross-container)
- Keyboard sensor presence/absence (only add where missing, don't remove)

## Files

| File | Change |
|------|--------|
| `src/components/jobs/DraggableCandidateCard.tsx` | Remove extra CSS transition on non-dragging state |
| `src/components/jobs/DraggableStageItem.tsx` | Remove conflicting shadow class when dragging |
| `src/components/jobs/PipelineOverview.tsx` | Unify overlay style constants |
| `src/components/jobs/HiringPlanTab.tsx` | Unify overlay style + add TouchSensor |
| `src/components/jobs/OfferApprovalChainConfig.tsx` | Remove conflicting opacity class + unify overlay + add TouchSensor |
| `src/components/jobs/stage-config/InterviewQuestionsList.tsx` | Remove conflicting opacity/shadow class + unify overlay + add TouchSensor |
| `src/components/settings/OfferFormFieldsManager.tsx` | Add dropAnimation + overlay styling + TouchSensor |
| `src/components/jobs/postings/PostingFieldsBuilder.tsx` | Add dropAnimation + overlay styling + TouchSensor |
| `src/components/jobs/DropZone.tsx` | Refine transition duration |


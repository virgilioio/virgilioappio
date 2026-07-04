## Problem

Clicking the trash icon on a hiring-plan stage does nothing — no confirm dialog, no error, no toast.

## Root cause

`DraggableStageItem` is documented (and typed) so that `onRemove` receives the row's **instance id** (persisted `jhsId` or the temporary client id used for unsaved rows). The parent `HiringPlanTab.handleRemoveRowRequest` looks the row up by `instanceId`:

```ts
const row = planRows.find((r) => r.instanceId === instanceId)
if (!row) return   // ← silent early-return
```

But inside `DraggableStageItem` the click handler is wired to the wrong value:

```tsx
onClick={(e) => {
  e.stopPropagation()
  onRemove(stage.id)   // ← passes job_stages.id, not the row's instanceId
}}
```

`stage.id` is the shared `job_stages` catalog id, never equal to a row's `instanceId`, so `find(...)` returns undefined and the handler silently bails out. This affects both the Create Job wizard and the Edit Job hiring plan tab (both render the same component).

## Fix

Change one line in `src/components/jobs/DraggableStageItem.tsx` (line ~152) inside the delete `<Button>` onClick:

- Replace `onRemove(stage.id)` with `onRemove(instanceId)`.

That's it — `instanceId` is already a prop on the component and is the value the handler expects.

## Verification

- In Edit Job → Hiring Plan: click trash on a non-default stage → confirmation dialog opens with the candidate-count check, then removal saves and toast appears.
- In Create Job wizard: click trash on a newly added stage → row is removed from the unsaved plan.
- Default/locked stages still hide the trash button (unchanged).

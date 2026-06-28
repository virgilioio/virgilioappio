## Goal

Allow the same stage from the library to be added multiple times into a job's hiring plan (e.g., two "Interview" rounds), in every place where hiring plans are built (Job → Hiring Plan tab, Job Wizard → Hiring Plan step, and any template apply flow).

Today the system keys hiring-plan rows by `stage_id`, so once a stage is added it is removed from the picker and `saveHiringPlan` dedupes duplicates. We'll switch the entire flow to be keyed by the per-row instance id (`job_hiring_stages.id`, aka `jhsId`) instead.

## Changes

### 1. Database (`job_hiring_stages`)
- Drop the `job_hiring_stages_job_stage_unique` constraint on `(job_id, stage_id)` so the same `stage_id` can appear multiple times in one job's plan.
- Keep the `(job_id, position)` unique constraint and all RLS policies untouched.

### 2. `useJobHiringPlan` hook (`src/hooks/useJobHiringPlan.ts`)
- `loadHiringPlan` and `loadHiringPlanInstances`: preserve duplicate rows (currently the Map-by-stage-id collapses them). Return one entry per `job_hiring_stages` row, each carrying its own `jhsId`.
- Rewrite `saveHiringPlan` to operate on instance identity:
  - Input becomes an ordered list of `{ jhsId?: string; stage_id: string; custom_stage_name?: string | null }`.
  - "Keep" = rows whose `jhsId` matches an existing row; "Insert" = entries without a `jhsId` (newly added duplicates included); "Delete" = existing rows whose `jhsId` is no longer present.
  - Phase ordering (temp position blocks, candidate reassignment on delete, final 1..n renumber) stays the same — just keyed by `jhsId`.

### 3. Hiring Plan tab (`src/components/jobs/HiringPlanTab.tsx`)
- State `selectedStages` becomes a list of plan instances `{ jhsId?: string; stage: JobStage; customStageName?: string | null }` — React keys, drag ids, and the instances map all use `jhsId` (or a temp client id for not-yet-saved instances).
- `availableStages` is no longer reduced when you pick a stage — every library stage remains pickable indefinitely. Drop the `setAvailableStages(prev => prev.filter(...))` call in `handleAddStage` and the equivalent "remove from selected → put back into available" in `handleConfirmRemove`.
- `handleAddStage` appends a fresh instance (no `jhsId` yet) instead of moving the stage between lists.
- `handleRemoveStageRequest` / `handleConfirmRemove` look up the candidate count and reassignment by the row's own `jhsId`, not by `stage_id`.
- DnD `SortableContext` items list and `DraggableStageItem` `id` prop switch to the instance id so duplicates can be reordered independently.
- The "Cannot remove default stages" rule still applies, but per-instance: if a default stage is added twice, the extra instance is removable; the canonical default instance is not.

### 4. Wizard `HiringPlanStep` template apply (`src/components/jobs/wizard/HiringPlanStep.tsx`)
- Remove the `usedIds` dedupe in `applyTemplate`: a template like `['interview','interview']` should resolve to two interview instances of the same library stage, not skip the second.
- Pass the resolved list to the new `saveHiringPlan` signature (one entry per occurrence, no `jhsId`).

### 5. `DraggableStageItem` (`src/components/jobs/DraggableStageItem.tsx`)
- Accept and use the instance id for `useSortable({ id })` and for `onRemove`, so duplicates each have a stable, distinct DnD identity.

### 6. Downstream readers
- `StageConfigSheet` already keys off `jhsId` — no change.
- Anything else that maps "stage_id → jhsId" via `instancesMap` (e.g., pipeline lookups in the tab) must switch to iterating the ordered instance list instead of a `Map` keyed by `stage_id`. Audit during implementation: `Map<stage_id, …>` lookups in `HiringPlanTab` and the `loadHiringPlanInstances` consumers.

## Out of scope
- No changes to how candidates are stored on a stage (still `current_stage_id` = `job_hiring_stages.id`, which already works per-instance).
- No UI redesign — same picker, same row layout. Stages just stay available after being added, and duplicates render as separate rows.

## Verification
- Add the same stage twice in the Hiring Plan tab → save → reload → both rows persist in order, each independently configurable, draggable, and removable.
- Apply the "Exec / leadership" template → three Interview rows appear (previously collapsed to one).
- Remove one of two duplicate instances → candidates on that specific instance get reassigned to the previous stage; the other duplicate is unaffected.

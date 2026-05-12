## 1. Owner field → SearchableSelect (DealFormSheet)

In `src/components/deals/DealFormSheet.tsx`, replace the plain `Select` for `owner_id` with `SearchableSelect`, mirroring the Company picker pattern already in the same form.

- Build `ownerOptions: SearchableSelectOption[]` from `activeMembers`, using `value: m.user_id`, `label: full name || email`.
- Props: `placeholder="Select an owner"`, `searchPlaceholder="Search members..."`, `emptyMessage="No members found."`.
- Remove unused `Select*` imports if no longer used.

## 2. Primary submit button → match "Create & Continue"

In `DealFormSheet.tsx`, update the footer submit button to match `JobWizard.tsx` (line 270–278):

- Drop the custom `bg-virgilio-purple hover:bg-virgilio-purple/90` classes (use default primary).
- Add `className="flex items-center gap-2"` and a trailing `<ChevronRight className="w-4 h-4" />` icon.
- Label: `isSubmitting ? 'Creating...' : 'Create deal'` (keep "Save changes" for edit mode, no chevron in edit, to stay consistent — or keep chevron only in create mode like the wizard).

## 3. Deal Stages settings → mirror Hiring Plan editor

Rewrite `src/components/settings/DealStagesManager.tsx` to use the exact patterns from `src/components/jobs/HiringPlanTab.tsx` + `DraggableStageItem.tsx`.

Layout:
- Page wrapped in `space-y-6`, header `<h3>Deal Stages</h3>` + helper paragraph, mirroring HiringPlanTab tone.
- One section "Current Pipeline Stages" listing all deal stages as draggable cards.
- Footer bar with `Total stages: N` on the left and a `Save` button on the right (only enabled when `hasUnsavedChanges`).
- "Add stage" entry below the list using the same `SearchableSelect`-style row OR, since deal stages are user-defined (no library), a simple "Add stage" button that opens the existing StageFormSheet (kept).

DnD card (new `DraggableDealStageItem.tsx`, copy of `DraggableStageItem.tsx`):
- `@dnd-kit` `useSortable` with `CSS.Translate`, opacity-on-drag, `PointerSensor` distance 5, `KeyboardSensor`.
- `Card` + `CardContent p-4`, drag handle in `bg-primary/10 text-primary` rounded square, stage name + `Badge` for `stage_type`.
- Badge variants map: `open → pastel-blue`, `won → success`, `lost → secondary`.
- Right-side actions: `Pencil` (edit → opens existing StageFormSheet), `Trash2` (delete → existing AlertDialog confirm).
- `DragOverlay` with the same `rotate(-1.5deg) scale(1.03)` shadow.

State:
- Local `selectedStages` initialized from `useDealStages().data`, `hasUnsavedChanges` flag, save button calls `reorderStages.mutate(orderedIds)`.
- `createStage`, `updateStage`, `deleteStage` continue to invalidate via the existing hook.

No DB or hook changes. No route changes.

## Files

Edit:
- `src/components/deals/DealFormSheet.tsx` — owner SearchableSelect, button restyle.
- `src/components/settings/DealStagesManager.tsx` — full rewrite to Hiring Plan layout.

Create:
- `src/components/settings/DraggableDealStageItem.tsx` — Hiring Plan-style DnD card adapted to deal stages.

## Out of scope

Kanban board, profile sheet, hooks, RLS, organizations, routes.
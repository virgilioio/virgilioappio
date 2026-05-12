## Goal

Bring the Deals Kanban and the New Deal form fully in line with the existing Jobs pipeline design and form conventions — no new design, only reuse.

---

## 1. Kanban: replicate the Jobs Pipeline board

Refactor `src/components/deals/DealsKanbanBoard.tsx` to mirror `src/components/jobs/PipelineOverview.tsx` (board view), including when there are zero deals.

- **Always render the columns** (even with zero deals). Drop the global "No deals yet" empty state — empty pipeline is a valid state.
- Each column = `Card` with:
  - `CardHeader` tinted via a `getHeaderBgClass(stage_type)` helper, mapped to our existing pastel tokens (`bg-pastel-blue/20`, `bg-pastel-purple/20`, `bg-success/20` for Won, `bg-pastel-orange/20`/`bg-warning/20` for Negotiation, `bg-secondary/20` default; Lost uses `bg-secondary/20`).
  - `CardTitle` shows the stage name (`text-base font-medium truncate`), followed by a count `Badge variant="secondary"` and the stage total amount (right side, small muted).
  - `CardContent` keeps the same tint, scrollable, contains `DroppableStage` (reuse `src/components/jobs/DroppableStage.tsx` directly).
  - Empty-stage placeholder text: `"No deals in this stage"` (`text-xs text-text-tertiary`), matching jobs.
- Column width: `w-[calc(100vw-3rem)] sm:w-72 flex-shrink-0 h-full flex flex-col snap-center sm:snap-align-none`.
- Wrap the board in the same outer structure used by jobs pipeline: a horizontal-scroll container inside a `Card`/table-like frame so the board reads as "inside a table" (use the existing `Card` wrapper pattern from `PipelineOverview` board view — single outer `Card` with header row + horizontal scroll body).
- Keep current DnD wiring (`@dnd-kit` + `moveDeal`), but swap the in-house `DroppableDealStage` for the existing `DroppableStage` from jobs to get identical drop-zone visuals. Remove `KanbanPrimitives.tsx` once unused (or keep `DraggableDealCard` only).
- Loading: keep Initial-Load-Only `Skeleton` columns matching new column dimensions.
- The "no stages defined" GioEmptyState remains as a fallback only when `stages.length === 0`.

## 2. "New deal" button = exact copy of "Create Job"

In `src/pages/Deals.tsx`, replace the current purple button with the same markup used by `JobsTable` (line 287):

```tsx
<Button onClick={() => setCreating(true)} size="sm" className="gap-1.5 h-8 whitespace-nowrap">
  <Plus className="h-3.5 w-3.5" />
  New Deal
</Button>
```

Default variant (primary token), no custom `bg-virgilio-purple` overrides.

## 3. Searchable Company picker in DealFormSheet

In `src/components/deals/DealFormSheet.tsx`, replace the plain `Select` for `organization_id` with the same `SearchableSelect` component used by `JobFormSheet`:

- Import `SearchableSelect`, `SearchableSelectOption` from `@/components/ui/searchable-select`.
- Map `organizations` (active only) into `{ value, label }[]`.
- Same placeholder pattern ("Select a company"), same height/focus tokens as Job form.

## 4. Date selector = Virgilio style-guide picker

Replace the raw `<Input type="date" />` for `expected_close_date` with `DatePickerVirgilio` (`src/components/ui/date-picker-virgilio.tsx`):

- Store value as ISO date string in the form (`format(date, 'yyyy-MM-dd')`); parse back with `new Date(value)` for the picker's `value` prop.
- Pass `placeholder="Pick a close date"`.

---

## Files to edit

- `src/components/deals/DealsKanbanBoard.tsx` — full board refactor to mirror jobs pipeline (columns always visible, Card/CardHeader/CardContent, reuse `DroppableStage` from jobs).
- `src/components/deals/DealFormSheet.tsx` — `SearchableSelect` for company, `DatePickerVirgilio` for close date.
- `src/pages/Deals.tsx` — button styling to match `Create Job`.
- `src/components/deals/KanbanPrimitives.tsx` — keep `DraggableDealCard` only (or delete if no longer used after switching to `DroppableStage`).

## Out of scope

- No DB / hook / permission changes.
- No changes to `DealProfileSheet`, `DealStagesManager`, or routes.
- No new visual elements beyond what jobs pipeline already provides.

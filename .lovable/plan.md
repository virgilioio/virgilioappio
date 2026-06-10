## Make Pipeline filter pills functional

The Status / Owner / Department pills and the "Recent activity" sort pill are currently presentational — their click handlers are unused and the page always filters to `status === 'open'` with a hardcoded sort. Wire them to real state + popovers.

### State (in `src/pages/Pipeline.tsx`)
- `status: 'open' | 'draft' | 'closed' | 'archived' | 'all'` — default `'open'`.
- `selectedOwners: string[]` — default `[]` (empty = "Anyone").
- `selectedDepartments: string[]` — default `[]` (empty = "All").
- `sortBy: 'recent' | 'title' | 'active' | 'oldest'` — default `'recent'`.

### Filtering / sorting logic
Replace the current `openJobs` + `filteredJobs` memo with one `filteredJobs` memo that:
1. Filters by `status` (skip when `'all'`).
2. Filters by `selectedDepartments` against `job.department_id` (or `job.department` text fallback).
3. Filters by `selectedOwners` — match against `job.hiring_team` (array of user ids) and `job.created_by`. Reuse `useUserAssignedJobIds(selectedOwners)` like the legacy `FilterCard` integration did, plus the `jobMatchesUsers` helper already in the repo.
4. Filters by search.
5. Sorts by `sortBy`:
   - `recent` → `updated_at` desc (current behavior)
   - `oldest` → `updated_at` asc
   - `title` → `title` asc
   - `active` → metricsMap active_candidates desc, then title

The "Showing X of Y open jobs · sorted by …" line uses the chosen sort label and the chosen status label (e.g. "Showing 3 of 21 open jobs", or "Showing 3 of 5 closed jobs", or "Showing 3 of 26 jobs" when status = all).

### Dropdown UX (rebuild pills as proper menus)
Update `src/components/pipeline/PipelineFilterBar.tsx` so each pill is anchored to a real Radix popover using the project's existing dropdown primitives:

- **Status pill** — single-select via `<DropdownMenu>` with `<DropdownMenuRadioGroup>`. Options: All, Open ★ default, Draft, Closed, Archived. Pill is `active` (purple) whenever status ≠ default `'open'` OR... actually keep it always `active` to match current design but display the chosen label. Label: `Status · {Open|Draft|Closed|Archived|All}`.
- **Owner pill** — multi-select via `<FilterChipPopover>` (searchable, Apply pattern). Options from `useMembers()` filtered by `user_status === 'active'`. Label: `Owner · Anyone` (when empty) / `Owner · {Name}` (1) / `Owner · {N} selected` (>1). Pill `active` when any selected.
- **Department pill** — multi-select via `<FilterChipPopover>`. Options from `useDepartments()` (or fall back to `useOrganizations()` to mirror current data) — pick whichever the Jobs list uses so the values match `job.department_id`. Label: `Department · All` / `Department · {Name}` / `Department · {N} selected`. Pill `active` when any selected.
- **Sort pill** — single-select via `<DropdownMenu>` with `<DropdownMenuRadioGroup>`. Options: Recent activity ★ default, Oldest activity, Job title (A→Z), Active candidates. Label reflects choice. Pill `active` when sort ≠ `recent`.

All popovers should follow the dropdowns foundation (`src/lib/menu-classes.ts`, radius 12, 30h items) — no custom panel chrome.

### Persistence (out of scope for this fix)
Skip `usePersistentFilters` / `SavedViewSelector` integration — the current page doesn't use them and adding them would expand scope. If desired later, restore exactly what the old Pipeline page had.

### Props change for `PipelineFilterBar`
Replace the unused `onStatusClick`/`onOwnerClick`/`onDepartmentClick`/`onSortClick` callbacks with:
- `status`, `onStatusChange(value)`
- `ownerOptions: {value,label}[]`, `selectedOwners`, `onSelectedOwnersChange`
- `departmentOptions: {value,label}[]`, `selectedDepartments`, `onSelectedDepartmentsChange`
- `sortBy`, `onSortChange(value)`

Keep `search`, `grouped`, `allExpanded`, `onToggleGroup`, `onToggleExpandAll`, `onViewsClick` as-is. `onViewsClick` stays as a no-op stub (the Views pill remains visual until Saved Views are reconnected).

### Files touched
- `src/pages/Pipeline.tsx` — extend state, filter/sort logic, wire props.
- `src/components/pipeline/PipelineFilterBar.tsx` — convert Status/Owner/Department/Sort pills into real anchored popovers, drop dead `on*Click` props.

### Non-goals
- No backend changes, no new hooks, no new RPCs.
- No saved-views wiring on this page.
- No changes to job rows, kanban, or metric strip.

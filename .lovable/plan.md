

# Replace Read-Only/Edit Toggle with Always-Editable Vertical Filters

## What Changes

The sidebar's "Search Criteria" section currently has two modes: a read-only badge display and an "Edit" mode that shows `EditableSearchCriteria`. We remove this toggle entirely and make the filters **always editable inline**, using `FilterCheckboxGroup` for list-based filters and compact text inputs for free-text fields — matching the vertical filter pattern from Candidates/Jobs sidebars.

## Layout After Changes

```text
SIDEBAR
├── Saved Searches (collapsible, unchanged)
├── ── separator ──
├── SEARCH CRITERIA (always editable)
│   ├── Job Titles: [compact input + add] + badge chips
│   ├── Keywords: [compact input + add] + badge chips  
│   ├── Locations: LocationSelector (unchanged)
│   ├── Seniority: FilterCheckboxGroup (all 11 options, checkboxes)
│   ├── Company Size: FilterCheckboxGroup (8 options, checkboxes)
│   ├── Industry: FilterCheckboxGroup (searchable, 24 options)
│   ├── Target Companies: [compact input + add] + badge chips
│   ├── Experience: min/max inputs
│   └── [Save & Refresh] button
├── ── separator ──
└── RESULT FILTERS (unchanged — Has Email / Has Phone checkboxes)
```

## Changes by File

### `src/components/sourcing/SourcingSidebar.tsx`

- Remove `isEditingCriteria` and `editableCriteria` state, and all edit/cancel/save toggle logic
- Always render an inline editable criteria section (no more conditional read-only vs edit view)
- For **Seniority**, **Company Size**, and **Industry**: use `FilterCheckboxGroup` with the existing option constants (from `EditableSearchCriteria`). These become vertical checkbox lists with search (for Industry). No counts needed — pass `count: 0` or omit (the component handles it).
- For **Job Titles**, **Keywords**, **Target Companies**: keep compact `Input` + `Plus` button + removable badges (same as `EditableSearchCriteria` but styled smaller to fit sidebar)
- For **Locations**: keep `LocationSelector` as-is
- For **Experience**: keep the min/max number inputs
- The criteria state is derived directly from `project.search_criteria` — edits call `onUpdateSearchCriteria` via a single "Save & Refresh" button at the bottom
- Keep a local `editableCriteria` state initialized from `project.search_criteria`, but it's always visible/editable (no toggle)

### `src/components/sourcing/EditableSearchCriteria.tsx`

- No changes needed — but it will no longer be imported by `SourcingSidebar`. It may still be used by `RoleInterpretationDrawer` or other places. If it's only used by the sidebar, it becomes dead code (can be cleaned up later).

### `src/components/ui/filter-checkbox-group.tsx`

- Minor: make `count` optional in `FilterCheckboxOption` (default to hiding the count span when 0 or undefined) so sourcing filters can use it without fabricating counts.

## Technical Notes

- The `FilterCheckboxGroup` expects `{ value, label, count }` options. We'll map `SENIORITY_OPTIONS`, `COMPANY_SIZE_OPTIONS`, `INDUSTRY_OPTIONS` into this shape with `count: 0`.
- When count is 0, hide the count span to avoid showing "0" next to every option.
- The `onToggle` callback will update the local `editableCriteria` state for the corresponding array field.
- "Save & Refresh" button persists at the bottom and calls `onUpdateSearchCriteria(editableCriteria)`.

## Files Summary

| File | Action |
|------|--------|
| `SourcingSidebar.tsx` | Rewrite criteria section: remove read-only view, always show editable filters using `FilterCheckboxGroup` for lists and compact inputs for free-text |
| `filter-checkbox-group.tsx` | Make `count` optional, hide count span when falsy |


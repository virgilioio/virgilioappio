

# Fix Saved Views: Filters Not Applied + Ellipsis Menu Z-Index

## Problem 1: Selecting a saved view doesn't apply filters

**Root cause**: In `IndependentCandidateTable.tsx`, `setFiltersFromRecord` (line 197) only restores a subset of array filter keys. It's missing:
- `companies`, `jobs`, `stages`, `rejectedAtStages` (array filters)
- `experienceMin`, `experienceMax`, `salaryMin`, `salaryMax` (numeric filters)
- `dateFrom`, `dateTo` (date filters)

**Fix**: Update `setFiltersFromRecord` to restore ALL filter keys using `setArrayFilter`, `setNumericFilter`, and `setDateFilter` from the candidate filter context. The full list of array keys should match `CandidateFilters`.

## Problem 2: Ellipsis menu opens behind the saved views dropdown

**Root cause**: The `DropdownMenuContent` inside the `PopoverContent` renders at a lower z-index than the popover.

**Fix**: In `SavedViewSelector.tsx`, add `className="z-[200]"` to the `DropdownMenuContent` (line 143) and add `modal={false}` to the `DropdownMenu` (line 137) so it doesn't fight with the popover's portal.

## Files changed

| File | Change |
|------|--------|
| `src/components/candidates/IndependentCandidateTable.tsx` | Expand `setFiltersFromRecord` to restore all array keys + numeric + date filters using context setters |
| `src/components/filters/SavedViewSelector.tsx` | Add `modal={false}` to DropdownMenu + `z-[200]` to DropdownMenuContent |


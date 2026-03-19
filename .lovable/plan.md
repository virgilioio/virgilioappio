

# Standardize Table Header Layout + Skeleton Loaders

## New 4-Row Toolbar Structure

```text
Row 1: [SavedViewSelector]
Row 2: [Search bar] [Chipped filters] [Clear filters]
Row 3: [Action buttons LEFT-aligned] (Add, Select, Import, Bulk, Create, etc.)
Row 4: X of Y candidates/jobs
```

## Changes

### 1. `src/pages/Candidates.tsx`

- Remove Import CSV and Bulk Upload buttons from the `<PageHeader>` children
- Pass `onImportCSV` and `onBulkUpload` callbacks to `IndependentCandidateTable`

### 2. `src/components/candidates/IndependentCandidateTable.tsx`

**Props**: Add `onImportCSV?: () => void` and `onBulkUpload?: () => void`.

**Toolbar restructure** — break the single `flex-wrap` div into 4 distinct rows:

- **Row 1**: `SavedViewSelector` alone
- **Row 2**: Search input + `CandidateFiltersPanel` chips + clear filters — same row, no action buttons
- **Row 3**: `flex items-center gap-2` with left-aligned: Add Candidate, Select, Import CSV, Bulk Upload buttons (no `ml-auto`)
- **Row 4**: `X of Y candidates` count line

**Skeleton**: Update the loading skeleton to mirror this 4-row structure:
- Row 1: `Skeleton h-8 w-40` (view selector)
- Row 2: `Skeleton h-8 w-56` + 2–3 `Skeleton h-8 w-24` (search + chips)
- Row 3: 3–4 `Skeleton h-8 w-28` left-aligned (buttons)
- Row 4: `Skeleton h-3 w-32` (count text)
- Then `TableSkeleton rows={8}`

### 3. `src/components/jobs/JobsTable.tsx`

**Toolbar restructure** — same pattern (no saved views yet, so skip Row 1):

- **Row 1**: Search input + Status/Org/User filter chips + clear filters
- **Row 2**: Create Job button — left-aligned (remove `ml-auto`)
- **Row 3**: `X of Y jobs` count line (new — currently only in pagination footer)

**Skeleton**: Update to match:
- Row 1: `Skeleton h-8 w-56` + 2–3 `Skeleton h-8 w-24`
- Row 2: `Skeleton h-8 w-28`
- Row 3: `Skeleton h-3 w-32`
- Then `TableSkeleton rows={5}`

### Files

| File | Change |
|------|--------|
| `src/pages/Candidates.tsx` | Move Import/Bulk buttons out of PageHeader, pass as props |
| `src/components/candidates/IndependentCandidateTable.tsx` | 4-row toolbar, accept new props, updated skeleton |
| `src/components/jobs/JobsTable.tsx` | 3-row toolbar (no views), left-align Create Job, add count row, updated skeleton |


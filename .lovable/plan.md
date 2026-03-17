

# Add Job, Stage, and "Rejected at Stage" Filters to Candidates Page

## Current State
The candidates page already fetches all `AssociationDetail` records (via `useCandidateJobAssociationsMap`) which include `jobId`, `jobTitle`, `stageName`, and `pipelineStatus`. The existing "Pipeline" filter chip filters by pipeline status (active/rejected/hired/offer). However, there are no **Job** or **Stage** filter chips, and no way to filter by "rejected at a specific stage."

## Design

Add three new filter dimensions to the candidate filter system:

1. **Job filter** — multi-select, show candidates associated with selected jobs
2. **Stage filter** — multi-select, show candidates currently at (or last at) selected stages
3. **Rejected at Stage filter** — multi-select, show candidates who were rejected while at a specific stage (i.e., `pipelineStatus === 'rejected'` AND `stageName` matches)

All data is already available in the `associations` array — no database changes needed.

## Files to Change

### 1. `src/contexts/CandidateFilterContext.tsx`
- Add three new array filter keys to `CandidateFilters`: `jobs: string[]`, `stages: string[]`, `rejectedAtStages: string[]`
- Add them to `EMPTY_FILTERS`, `ArrayFilterKey` type, and the `activeFilterCount` calculation

### 2. `src/hooks/useCandidateFilterOptions.ts`
- Derive `jobOptions` from associations (unique `jobId`→`jobTitle` pairs with candidate counts)
- Derive `stageOptions` from associations (unique `stageName` values with counts)
- Derive `rejectedAtStageOptions` from associations where `pipelineStatus === 'rejected'` and `stageName` exists (counts of rejections per stage)
- Return all three new option arrays

### 3. `src/hooks/useCandidateFilteredData.ts`
- Add filtering logic for `filters.jobs`: candidate must have at least one association whose `jobId` is in the selected set
- Add filtering logic for `filters.stages`: candidate must have at least one association whose `stageName` is in the selected set
- Add filtering logic for `filters.rejectedAtStages`: candidate must have at least one association where `pipelineStatus === 'rejected'` AND `stageName` is in the selected set

### 4. `src/components/candidates/CandidateFiltersPanel.tsx`
- Add `jobOptions`, `stageOptions`, `rejectedAtStageOptions` to the `filterOptions` interface
- Add a **Job** `FilterChipPopover` in the toolbar (searchable, since jobs can be numerous)
- Add a **Stage** `FilterChipPopover` in the toolbar
- Add a **Rejected at Stage** `FilterChipPopover` in the toolbar (or in the "More Filters" sheet if toolbar is crowded — placing it in toolbar for discoverability)
- Add the three new keys to the `activeTags` loop so selected values render as removable chips

### 5. `src/components/candidates/IndependentCandidateTable.tsx`
- Pass the new `jobOptions`, `stageOptions`, `rejectedAtStageOptions` from `filterOptions` down to `CandidateFiltersPanel`

## Filtering Logic Detail

```text
jobs filter:        assocs.some(a => filters.jobs.includes(a.jobId))
stages filter:      assocs.some(a => a.stageName && filters.stages.includes(a.stageName))
rejectedAtStages:   assocs.some(a => a.pipelineStatus === 'rejected' 
                                  && a.stageName 
                                  && filters.rejectedAtStages.includes(a.stageName))
```

No database migration required — all data already exists in the fetched associations.


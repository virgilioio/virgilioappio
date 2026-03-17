

# Fix Cascading Load / Clunky Progressive Rendering

## Problem

Multiple pages (Candidates being the worst offender) show content in stages because data fetches are chained rather than parallel. The sequence is:

1. **Candidates fetch** completes → table renders immediately (no Job Status data yet)
2. `useCandidateJobAssociationsMap` fires (depends on `candidateIds` from step 1) → Job Status column pops in
3. Filter options derived from associations update → filter chips shift/appear

This pattern repeats in other places (pipeline, sourcing, dashboard widgets) where secondary data loads after the primary data, causing layout shifts.

## Solution: Unified Loading Gate

The fix is straightforward — treat the page as "still loading" until **all** required data is ready, and show skeletons until then.

### 1. Candidates Page — Composite `isReady` flag

**File:** `IndependentCandidateTable.tsx`

The `useCandidateJobAssociationsMap` hook already returns `isLoading`. Currently, only the parent `isLoading` (candidates fetch) gates the skeleton. Change the skeleton condition to:

```tsx
const associationsLoading = useCandidateJobAssociationsMap(candidateIds).isLoading
const isFullyLoaded = !isLoading && !associationsLoading

// Line ~321: change condition
if (!isFullyLoaded) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex gap-4 mb-4">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
        <TableSkeleton rows={8} />
      </CardContent>
    </Card>
  )
}
```

This is already destructured on line 80; we just need to use the existing `isLoading` from that hook in the gate condition.

### 2. Pipeline Page — Gate on `usePipelineCandidateStatuses`

**File:** `PipelineOverview.tsx`

The pipeline fetches hiring plan stages, then candidate associations, then status enrichments. Ensure the skeleton shows until the status map hook (`usePipelineCandidateStatuses`) has also resolved. Same pattern: combine all `isLoading` flags into one `isFullyLoaded`.

### 3. Dashboard Widgets — Individual widget skeletons

Each dashboard widget (Stale Candidates, Pending Tasks, etc.) should show its own skeleton/spinner until its data is fully resolved. Most already do this correctly. The main fix is ensuring any widget that has cascading fetches uses a composite loading flag.

### 4. Sourcing Candidates Tab

**File:** `CandidatesTab.tsx` / `SourcingCandidateTable.tsx`

Same pattern — if there's a secondary enrichment fetch after the main candidates load, gate on both.

## Files to Change

| File | Change |
|------|--------|
| `IndependentCandidateTable.tsx` | Use `isLoading \|\| associationsIsLoading` as the skeleton gate (line ~321) |
| `PipelineOverview.tsx` | Combine all loading flags into single gate before rendering content |
| `SourcingCandidateTable.tsx` | Audit for cascading loads, add composite gate if needed |
| Dashboard widget components | Audit each for cascading fetches, fix any that render partial data |

## Impact

- No new queries or schema changes
- No new dependencies
- Skeleton shows slightly longer but the perceived UX is dramatically better — no layout shifts, no columns popping in, no filter chips appearing one by one
- All content appears in one clean render


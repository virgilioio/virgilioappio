

# Unified Loading Gates: Jobs, Pipeline, Job Detail + Pipeline Overview

## Changes

### 1. `JobsTable.tsx` — Gate on `membersLoading`

Line 183: change `if (isLoading)` → `if (isLoading || membersLoading)`. This prevents the User filter chip from popping in after the table renders.

### 2. `Pipeline.tsx` — Replace text loader with skeleton

Line 216: replace `"Loading jobs..."` text with a `TableSkeleton` component for visual consistency.

### 3. `JobDetail.tsx` — Skeleton placeholders in tab badge counts

The tab badges (Application Review, Recruiting, Offers, Hired, Rejected) show `0` initially then jump to real counts once `statusListsLoading` resolves. While `statusListsLoading` is true, show a small inline `Skeleton` (`h-3 w-6`) inside each Badge instead of `0`. This applies to both the mobile dropdown and the desktop TabsList (lines ~867-957).

### 4. `PipelineOverview.tsx` — Already fixed

The previous round already added a unified loading gate on line 563: `(isLoadingPlan || isLoadingCandidates || isStatusLoading)`. No further changes needed here — the Job > Pipeline Overview is already gated correctly.

## Summary of file changes

| File | Change |
|------|--------|
| `src/components/jobs/JobsTable.tsx` | Line 183: `isLoading \|\| membersLoading` |
| `src/pages/Pipeline.tsx` | Line 216: Replace text with `<TableSkeleton />` |
| `src/pages/JobDetail.tsx` | Lines ~867-957: Show `<Skeleton>` in tab badges while `statusListsLoading` is true |

No new dependencies, no schema changes. Three small surgical edits.


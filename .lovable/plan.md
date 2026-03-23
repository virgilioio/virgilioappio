

# Fix Pipeline Skeleton Flash After Drag-and-Drop

## Root Cause

The `onDragEnd` handler already does optimistic update + `silentRefresh()` correctly. But it also calls `onStageChanged?.()` (line 356), which triggers `setPipelineRefresh(v => v + 1)` in JobDetail.tsx. This increments `refreshToken`, which triggers the `useEffect` at line 285-289 that calls `loadPipeline()` — and `loadPipeline()` sets `isLoadingCandidates(true)`, showing the skeleton.

So the fix already in place (`silentRefresh`) is immediately undone by the `refreshToken` → `loadPipeline()` loop.

## Fix

Two changes in **`src/components/jobs/PipelineOverview.tsx`**:

1. **`refreshToken` useEffect (line 285-289)**: Use `silentRefresh()` instead of `loadPipeline()`. The `refreshToken` is also triggered by CandidateProfileSheet stage changes — those should also sync silently since the user is looking at the board.

2. **`handleMove` (line 291-294)**: This is called from dropdown/menu moves (not DnD). Replace `loadPipeline()` with `silentRefresh()` here too for consistency.

3. **`CandidateProfileSheet` callback (line 956)**: Replace `loadPipeline()` with `silentRefresh()`.

This ensures `loadPipeline()` (with skeleton) is only called on initial mount (line 271-283), never after user interactions.

## Files

| File | Change |
|------|--------|
| `src/components/jobs/PipelineOverview.tsx` | Replace `loadPipeline()` with `silentRefresh()` in refreshToken useEffect, handleMove, and CandidateProfileSheet callback |




# Fix Pipeline Kanban: Drop Zone Visibility + Reload Flash

## Problems

### 1. No drop zone in non-empty stages
`DropZone.tsx` line 19: when `size === 'compact'` (non-empty stage), height is always `h-0` — the drop zone never becomes visible regardless of hover. Users can't see where the card will land.

### 2. Full board flash on drop
`loadPipeline()` (line 230) sets `setIsLoadingCandidates(true)`, which triggers the skeleton loader (line 585), replacing the entire board with loading skeletons after every drop. The optimistic update works but is immediately obliterated by the loading state.

## Fixes

### Fix 1: Show drop zone in non-empty stages
**`src/components/jobs/DropZone.tsx`**

Change compact size behavior: when `active` (hovered), expand to `h-16` with the tinted background and border. When not hovered, stay at `h-0`. This gives a smooth animated insertion cue.

```
compact + active  →  h-16 (visible drop target)
compact + !active →  h-0  (hidden)
expanded + active →  h-40 (empty column)
expanded + !active → h-0
```

### Fix 2: Silent background sync after drop
**`src/components/jobs/PipelineOverview.tsx`**

Create a `silentRefresh` function that fetches data WITHOUT setting `isLoadingCandidates` to `true`. This preserves the optimistic UI while syncing server state in the background.

```tsx
const silentRefresh = useCallback(async () => {
  if (!jobId) return
  try {
    const associations = await fetchAssociationsForJob(jobId)
    const active = associations.filter(a => a.status !== 'rejected' && a.status !== 'hired' && a.status !== 'offer')
    const rejectedList = associations.filter(a => a.status === 'rejected')
    const hiredList = associations.filter(a => a.status === 'hired')
    const grouped: Record<string, PipelineAssociation[]> = {}
    active.forEach(a => {
      if (!a.current_stage_id) return
      if (!grouped[a.current_stage_id]) grouped[a.current_stage_id] = []
      grouped[a.current_stage_id].push(a)
    })
    setByStage(grouped)
    setRejected(rejectedList)
    setHired(hiredList)
  } catch (e) {
    console.error('Silent refresh failed:', e)
  }
}, [jobId, fetchAssociationsForJob])
```

Then in `onDragEnd` (lines 330, 340), replace `loadPipeline()` with `silentRefresh()`.

## Files

| File | Change |
|------|--------|
| `src/components/jobs/DropZone.tsx` | Make compact drop zone expand to `h-16` when hovered |
| `src/components/jobs/PipelineOverview.tsx` | Add `silentRefresh` that syncs without loading state; use in `onDragEnd` |


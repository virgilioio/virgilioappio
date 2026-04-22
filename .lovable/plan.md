

## Mobile pipeline: strip non-consultation chrome + fix bottom cutoff

### Part A — Hide create/filter/view chrome on mobile (consultation-only view)

**File: `src/pages/JobDetail.tsx`** (the mobile pipeline branch around lines 989–1114)

1. Hide the entire `<CardHeader>` of the main Pipeline Overview card on mobile. The cleanest fix is to add `hidden sm:block` to that `<CardHeader>` so on `<640px` it disappears entirely, removing:
   - "Pipeline Overview" title
   - "Add Candidate" / "Review Applications" buttons
   - "Select" button + bulk actions
   - Board / List view toggle
2. Since the second pipeline render block (lines ~1527+) mirrors this layout, apply the same `hidden sm:block` to its `<CardHeader>` so behavior stays consistent across both branches.
3. The mobile section selector card (the small one above with "Recruiting Process… 15") **stays** — it's read-only navigation between Recruiting / Application / Suggested / Rejected, which is consultation, not creation.

**File: `src/components/jobs/PipelineOverview.tsx`** (lines 617–628)

4. Hide the internal filter chips row (the `Favorite` `FilterChipPopover` block) on mobile by wrapping it with `hidden sm:flex` (currently `flex flex-wrap items-center gap-2`). On mobile the user sees only the stages and candidate cards.

This guarantees the mobile pipeline tab shows: section selector → stages + candidate cards. Nothing else.

### Part B — Fix the remaining bottom cutoff

The bottom of the last candidate card in a stage is still hidden behind the mobile bottom nav because the inner mobile scroll wrapper has no bottom padding to clear the fixed nav (~64px + safe-area inset).

**File: `src/pages/JobDetail.tsx`** (both mobile pipeline scroll wrappers, lines 1119 and 1528)

5. Update:
   ```tsx
   <div className="h-full min-h-[52dvh] w-full overflow-y-auto sm:hidden p-layout-md">
   ```
   to:
   ```tsx
   <div className="h-full min-h-[52dvh] w-full overflow-y-auto sm:hidden p-layout-md pb-[calc(env(safe-area-inset-bottom,0px)+96px)]">
   ```
   The 96px floor = mobile bottom nav (~72px) + breathing room (~24px) so the last card in a stage is fully visible above the nav. `safe-area-inset-bottom` handles iPhone notch/home-indicator devices.

### Out of scope
- Desktop layout (untouched — `CardHeader` only hides on `<640px`).
- The mobile section selector card (kept — it's read-only navigation).
- The candidate profile sheet (separate, already addressed).
- `PipelineOverviewTable.tsx` analytics (unrelated).

### Files touched
- `src/pages/JobDetail.tsx`
- `src/components/jobs/PipelineOverview.tsx`

### Verification on 390×844
1. Pipeline tab shows: tabs → small "Recruiting Proce… 15" selector → stage column with candidate cards. No "Pipeline Overview" title, no Add Candidate / Select / view toggle, no Favorite filter chip.
2. The last candidate in a stage scrolls above the bottom nav with breathing room.
3. Desktop pipeline view is visually unchanged.


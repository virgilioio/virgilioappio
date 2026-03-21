

# Standardize All Skeletons with Bordered Container Pattern

## Reference Pattern (PipelineOverview)

The skeleton in the Recruiting Process tab wraps each placeholder in a container with `rounded-lg border bg-card` (or `bg-background`), giving skeleton items visible structure with a thin border. This is the target pattern for all skeletons.

## What Changes

### 1. Base skeleton primitives — `src/components/ui/skeleton.tsx`

- **`Skeleton` base**: Keep as-is (it's the pulse block itself, not a container)
- **`TableSkeleton`**: Wrap each row in `rounded-lg border bg-card p-3` container
- **`CardSkeleton`**: Wrap in `rounded-lg border bg-card` container
- **New export: `ListRowSkeleton`**: Reusable bordered list row with avatar + text pattern (the most common skeleton across the app). Accepts `rows` prop.

### 2. `CandidateTableSkeleton` — already has `border` on rows, no change needed

### 3. `CandidateProfileSkeleton` — `src/components/candidates/CandidateProfileSkeleton.tsx`

Wrap each section (details card, skills card, summary card, activity card, work experience card) in `rounded-lg border bg-card p-4` containers.

### 4. Dashboard skeletons

- **`JobsOverview.tsx`**: Wrap each list row in `rounded-lg border bg-card p-3`
- **`UpcomingActivities.tsx`**: The `h-[72px]` bars already look like rows — add `border bg-card` to them
- **`RecentSourcingProjects.tsx`**: Same bordered row treatment if it has inline skeletons

### 5. `IndependentCandidateProfile.tsx` — wrap the large skeleton blocks in `rounded-lg border bg-card`

### 6. `SavedCandidatesTab.tsx` — already has `border` on rows, no change needed

### 7. Settings skeletons (`CalendarSettingsTab`, `EmailAccountsSection`) — add bordered containers

### 8. `Pipeline.tsx` — uses `TableSkeleton` which will be updated in step 1

### 9. Style Guide — `src/components/settings/styleguide/SkeletonGuide.tsx`

- Add a new "Bordered Skeleton Pattern" section showing the standard container with border
- Update the code example to demonstrate the bordered wrapper pattern
- Add a note: "All skeletons use a thin border container (`rounded-lg border bg-card`) for visual structure"

## Files

| File | Change |
|------|--------|
| `src/components/ui/skeleton.tsx` | Update `TableSkeleton` and `CardSkeleton` with bordered containers; add `ListRowSkeleton` |
| `src/components/candidates/CandidateProfileSkeleton.tsx` | Wrap each section in bordered container |
| `src/components/dashboard/JobsOverview.tsx` | Add bordered row wrappers |
| `src/components/dashboard/UpcomingActivities.tsx` | Add border to skeleton rows |
| `src/pages/IndependentCandidateProfile.tsx` | Add bordered containers to skeleton blocks |
| `src/components/settings/CalendarSettingsTab.tsx` | Add bordered container |
| `src/components/settings/EmailAccountsSection.tsx` | Add bordered container |
| `src/components/settings/styleguide/SkeletonGuide.tsx` | Add bordered pattern section, update examples |


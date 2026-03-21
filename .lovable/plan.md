

# Fix Pipeline Skeleton Size + Standardize Candidate Table Empty States with Gio Avatar

## Problems

1. **Recruiting Process skeleton is tiny**: `PipelineOverview` shows a `TableSkeleton` inside a small card during loading — it doesn't fill the available height, making it look broken.

2. **No empty state when 0 candidates in Recruiting Process**: The board view shows "No candidates in this stage" per column, but if ALL stages are empty, there's no unified empty state. The list view shows "No candidates match your filters" which is misleading when there are simply no candidates.

3. **Inconsistent empty states**: `CandidateTable` uses the `EmptyState` component (which fetches a platform asset from the DB), while the rest of the app uses the Gio avatar pattern (`gio-face-empty.png` with `text-[1.38rem] font-semibold tracking-[-0.06em]` and a purple period). The suggested/application/offers/hired/rejected tabs also have plain text empty states that don't use Gio.

## Changes

### 1. `src/components/jobs/PipelineOverview.tsx` — Better skeleton + empty state

**Skeleton**: Replace the small `TableSkeleton rows={6}` card with a skeleton that mimics the board view — 3-4 column placeholders with header skeletons and card-shaped skeletons, filling the available height. This prevents the jarring size jump when the board renders.

**Empty state**: After loading, if `stageOptions.length > 0` but ALL stages have 0 candidates (board view), show a Gio empty state instead of just empty columns. Same for list view when `sortedData.length === 0` and there's no search/filter active.

### 2. `src/components/candidates/CandidateTable.tsx` — Gio empty state

Replace the `EmptyState` component usage (lines 287-292) with the Gio avatar pattern:
- `gio-face-empty.png` avatar (h-16 w-16, rounded-full)
- Title: `text-[1.38rem] font-semibold tracking-[-0.06em]` with purple period
- Subtitle: `text-sm text-text-secondary`
- Keep contextual messages (no candidates vs no filter matches)

### 3. `src/pages/JobDetail.tsx` — Gio empty states for all pipeline sub-tabs

Replace the plain text empty states in the suggested, application review, offers, hired, and rejected tabs with the same Gio pattern. Each gets a contextual message:
- Suggested: "No matching candidates found." / "Try adjusting skills or requirements."
- Application Review: "No applications yet." / "Candidates will appear here when they apply."
- Offers: "No offers yet." / "Move candidates to the offer stage."
- Hired: "No hired candidates." / "Celebrate when you make your first hire!"
- Rejected: "No rejected candidates." / "Candidates moved to rejected will appear here."

Also replace the loading text "Finding the best matching candidates..." with a proper skeleton.

### 4. Create shared helper `src/components/ui/GioEmptyState.tsx`

Extract the repeated Gio empty state pattern into a reusable component to avoid copy-pasting across all files:

```typescript
interface GioEmptyStateProps {
  title: string
  description?: string
  className?: string
}
```

Uses `gio-face-empty.png`, standard sizing, purple period. All the above files use this component.

## Files

| File | Change |
|------|--------|
| `src/components/ui/GioEmptyState.tsx` | New — shared Gio avatar empty state component |
| `src/components/jobs/PipelineOverview.tsx` | Board-style skeleton, Gio empty state for 0 candidates |
| `src/components/candidates/CandidateTable.tsx` | Replace `EmptyState` with `GioEmptyState` |
| `src/pages/JobDetail.tsx` | Gio empty states for suggested/application/offers/hired/rejected tabs |


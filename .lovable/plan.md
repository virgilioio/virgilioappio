

# Colorful Tabs + Structured Header for Find Results Table

## 1. Colorful pipeline-style tabs

**`src/components/sourcing/SourcingProjectView.tsx`** (lines 329-364)

Replace the current plain `TabsList` with the colorful gradient pattern from `JobDetail.tsx` (lines 926-963). Map the 4 tabs to distinct colors:

- **Chat with Gio** — blue-to-purple gradient (matches "Suggested" style with Sparkles icon)
- **Candidates** — pastel-purple background
- **Saved** — pastel-yellow background (like "Recruiting Process")
- **Archived** — pastel-blue background

Each tab gets `h-10 md:h-12`, pastel inactive background, solid active background, same `data-[state=active]` patterns used in the job pipeline.

## 2. Restructured header rows

**`src/pages/Find.tsx`** (lines 218-226) and **`src/components/sourcing/SourcingProjectView.tsx`**

Move the `SavedSearchSelector` from `Find.tsx`'s Card header into `SourcingProjectView` as **Row 1** above the tabs. This keeps it contextual to the project view.

**Row 1: SavedSearchSelector** — sits at top of the Card in `SourcingProjectView`, with the project name selector. When selecting a new search, it navigates to that project. Clicking "New Search" navigates to `/find` (already works via `onNewSearch`).

**Row 2: Button controls** — below the tabs, inside each tab's content area (specifically the Candidates tab). Re-surface the controls from `SourcingProjectHeader` that are currently orphaned:
- Link to Job / Change Linked Job button
- Unlock Profiles (bulk collect)
- Refresh Results
- More menu (visibility toggle, archive, delete, create job from spec)

These go into a horizontal toolbar row at the top of `CandidatesTab`, following the standardized table header layout pattern (left-aligned action buttons).

## 3. SavedSearchSelector: clear on new search

**`src/components/sourcing/SavedSearchSelector.tsx`**

Already calls `onNewSearch()` which navigates to `/find` — this clears the `projectId` param and resets the view. No change needed here, it already works correctly.

## Files

| File | Change |
|------|--------|
| `src/components/sourcing/SourcingProjectView.tsx` | Replace plain tabs with colorful pipeline-style tabs; add SavedSearchSelector as Row 1; pass project action handlers to CandidatesTab |
| `src/components/sourcing/CandidatesTab.tsx` | Add button controls toolbar (link to job, refresh, unlock, more menu) as Row 2 above the table |
| `src/pages/Find.tsx` | Remove SavedSearchSelector from Card header (it moves into SourcingProjectView); keep it visible only in `new` mode for the empty state |


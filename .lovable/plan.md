# Candidate hero refinements

## Changes (`ProfileHeroCard.tsx` only)

### 1. Remove the avatar
- Delete the avatar `<div>` and the `getInitials` helper.
- Identity row becomes a single column: name+badges, then meta line. Drop the outer `flex items-center gap-4` since nothing sits beside the identity block on the left anymore.

### 2. Move action buttons into the top strip
Move `Advance to {stage}`, `Schedule`, `Email` out of the identity row and into the top nav strip, placed just before the navigation arrows. AI Fit chip moves with them (still useful inline).

New top strip layout (single row, no divider):
```
[Back to job]  ·  [Breadcrumb]  · · · [AI Fit] [Advance] [Schedule] [Email] [‹] [›]
```

### 3. Remove the "X of Y" pager text
Drop the `{index} of {total}` span. Keep only the chevron buttons (with `hasPrev`/`hasNext` enabling/disabling). The `index`/`total` props stay in the type for now (still passed by the sheet) but become unused inside the strip — leave them tolerated to avoid touching the call site.

### 4. Identity row is now just text
After avatar removal, the identity row collapses to:
- Name (h1) + favorite heart + stage badge + LinkedIn icon
- Meta line (Applying for / Source / Applied / Full profile)

No right-side cluster anymore (it moved to the top strip).

## Files touched

- `src/components/candidates/profile/ProfileHeroCard.tsx`

## Out of scope

- `CandidateProfileSheet.tsx` (no prop changes needed)
- Stages card, Quick Actions sidebar, tab content
- Backend/data

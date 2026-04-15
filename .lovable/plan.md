
# Remove Source Breakdown Banner from Sourcing Candidate Table

## What to Remove

The banner showing "Showing X results — Y with full contact info PDL, Z previews Apollo" that appears at the top of the candidate table in sourcing projects.

## Location

`src/components/sourcing/SourcingCandidateTable.tsx`, lines 596-613

The banner is conditionally rendered when `sourceBreakdown` data is available and shows:
- Total candidate count
- PDL full contact info count (green badge)
- Apollo preview count (gray badge)
- Dismissible via X button

## Implementation

Delete lines 596-613 entirely:
- Remove the conditional block that renders the banner
- Remove the associated `bannerDismissed` state (no longer needed)
- Keep the Bulk Action Bar below it intact

## Files Modified
- `src/components/sourcing/SourcingCandidateTable.tsx` — remove banner JSX and unused state

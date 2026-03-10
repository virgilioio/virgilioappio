

# Match Stage Status Badge Colors to CandidateCard

## What changes
Update `CandidateJobStatusCell.tsx` to use the same colored badge variants and icons as `CandidateCard.tsx` instead of the plain `outline` variant.

## Badge mapping

| Status | Current | Match to CandidateCard |
|--------|---------|----------------------|
| Booking link sent | `variant="outline"` | `variant="secondary"` + Send icon |
| Pending schedule | `variant="outline"` | `variant="pastel-yellow"` + Clock icon |
| New in stage | `variant="outline"` | `variant="pastel-yellow"` + Clock icon |

## File: `src/components/candidates/CandidateJobStatusCell.tsx`

1. Import `Send`, `Clock` from lucide-react
2. Change `getStageStatusLabel` to return `{ label, variant, Icon }` instead of just a string — matching the CandidateCard logic
3. Replace the single `Badge variant="outline"` with the correct variant and icon per status


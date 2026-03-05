

# Center-Align "Offer Details" Title and Status Badge

## Problem
The `CardTitle` (`h3`) and `Badge` aren't visually centered despite `items-center` being present, likely due to `leading-tight` line-height on the title creating visual misalignment.

## Change — `src/components/candidates/CandidateOfferDetails.tsx` (line 217)

Add `items-center` is already there. The fix is to add explicit `leading-none` to the `CardTitle` to remove extra line-height padding that throws off vertical centering:

```tsx
<CardTitle className="leading-none">Offer Details</CardTitle>
```

This ensures the title text box matches the badge height for true vertical centering.


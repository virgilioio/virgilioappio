

# Move Heart Icon to Right of Name in CandidateCard

## Change

**File**: `src/components/jobs/CandidateCard.tsx` (~line 273-276)

Move the Heart icon from before the candidate name to after it:

```tsx
// Current order:
{props.isFavorite && <Heart ... />}
<div className="font-medium ...">{candidateName}</div>

// New order:
<div className="font-medium ...">{candidateName}</div>
{props.isFavorite && <Heart ... />}
```

One file, two lines swapped.


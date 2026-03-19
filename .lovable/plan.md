

# Fix Icon Button Aspect Ratio

## Problem
The Button component's default variant includes `min-h-[40px]` (for mobile touch targets), making the 32×32px (`h-8 w-8`) buttons stretch to 40px tall — causing the rectangular look.

## Fix
**File: `src/components/candidates/CandidateProfileSheet.tsx`** (~lines 921-923 and 935-937)

Add `min-h-0` to both buttons' className to override the base minimum height:

```tsx
// UserRound button (line 923)
className="h-8 w-8 p-0 min-h-0"

// LinkedIn button (line 937)
className="h-8 w-8 p-0 min-h-0"
```

This ensures both buttons render as perfect 32×32px squares.


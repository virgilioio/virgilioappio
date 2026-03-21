

# Fix Scroll in Sourcing Results Table

## Problem

The results `Card` on line 529 of `SourcingCandidateTable.tsx` has classes `hidden md:block flex-1 min-h-0 flex-col overflow-hidden`. The `flex-col` and `flex-1` require `flex` display, but `md:block` sets it to `block`, so the flex layout never activates. This means `min-h-0` doesn't propagate and the `overflow-y-auto` inner div can't scroll.

## Fix

**`src/components/sourcing/SourcingCandidateTable.tsx` line 529**

Change `hidden md:block` → `hidden md:flex` so the flex layout activates and the overflow scrolling works.

```
- <Card className="shadow-calendly hidden md:block flex-1 min-h-0 flex-col overflow-hidden">
+ <Card className="shadow-calendly hidden md:flex flex-1 min-h-0 flex-col overflow-hidden">
```

| File | Change |
|------|--------|
| `src/components/sourcing/SourcingCandidateTable.tsx` | Line 529: `md:block` → `md:flex` |


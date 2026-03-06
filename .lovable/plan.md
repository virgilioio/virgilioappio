

# Fix: Right Button Control Card Overflow in Independent Profile Sheet

## Problem

The independent candidate profile sheet's right-side controls card (lines 795-864) has buttons laid out with `flex items-center justify-between w-full` but no overflow handling. On narrower screens, buttons spill outside the card.

The job-associated `CandidateProfileSheet` (lines 1575-1576) already solves this with:
```html
<div class="overflow-x-auto scrollbar-none w-full">
  <div class="flex items-center justify-between min-w-max">
```

## Fix

Apply the same wrapper pattern to `IndependentCandidateProfileSheet.tsx` at line 797:

**Before:**
```html
<div className="flex items-center justify-between w-full">
```

**After:**
```html
<div className="overflow-x-auto scrollbar-none w-full">
  <div className="flex items-center justify-between min-w-max">
    ...existing buttons...
  </div>
</div>
```

Single file change: `src/components/candidates/IndependentCandidateProfileSheet.tsx`, lines ~797 and ~862.




# Add Horizontal Scroll to Right Controls Card

## Problem
The right-side controls card (line 1464) uses a plain `flex` container without overflow handling, so buttons overflow outside the card on narrower screens. The left-side controls card already has this solved with `overflow-x-auto scrollbar-none` and `min-w-max`.

## Change: `src/components/candidates/CandidateProfileSheet.tsx`

Wrap the outer `div` at line 1464 with horizontal scroll, matching the left card pattern:

**Line 1464** — change:
```tsx
<div className="flex items-center justify-between w-full">
```
to:
```tsx
<div className="overflow-x-auto scrollbar-none w-full">
  <div className="flex items-center justify-between min-w-max">
```

**Line 1534** — close the extra wrapper div (add `</div>` before the existing `</div>`).

This applies the same `overflow-x-auto scrollbar-none` + `min-w-max` pattern already used on the left controls card.


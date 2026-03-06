

# Fix AI Profile Summary Smooth Animation

## Problem
The `CollapsibleContent` uses `animate-accordion-up`/`animate-accordion-down` which reference `var(--radix-accordion-content-height)`. But Radix's Collapsible sets `--radix-collapsible-content-height` instead — so the animation has no height value and doesn't work.

## Solution

Add two new keyframes and animations in `tailwind.config.ts` for collapsible:

```
"collapsible-down": {
  from: { height: "0", opacity: "0" },
  to: { height: "var(--radix-collapsible-content-height)", opacity: "1" }
},
"collapsible-up": {
  from: { height: "var(--radix-collapsible-content-height)", opacity: "1" },
  to: { height: "0", opacity: "0" }
}
```

And corresponding animation entries:
```
"collapsible-down": "collapsible-down 0.2s ease-out",
"collapsible-up": "collapsible-up 0.2s ease-out"
```

Then update `IndependentCandidateProfileSheet.tsx` line 423 to use the new classes:
```
data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down
```

## Files changed
- `tailwind.config.ts` — add collapsible keyframes + animations
- `src/components/candidates/IndependentCandidateProfileSheet.tsx` — use new animation classes


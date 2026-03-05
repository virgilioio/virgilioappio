

# Fix AI Analysis Button — Match App Button Style + Gradient Border

## Problem
The current button has fully rounded corners and a colored background that doesn't match the app's design system. The user wants it to follow the existing button styling (rounded-lg corners per the style guide) with a transparent interior, using only the multicolor gradient as the border.

## Change: `src/components/candidates/ExpandableScoreDisplay.tsx` (lines 43-55)

Update the wrapper and inner button to use the app's standard border-radius (`rounded-lg`) and a clean `bg-card` background:

```tsx
<div className="rounded-lg p-[2px] bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 opacity-80 hover:opacity-100 transition-opacity group">
  <button
    type="button"
    onClick={() => firstAiDraft && onOpenFullSheet?.(firstAiDraft.id)}
    className="flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-[6px] bg-card group-hover:bg-accent/10 transition-all duration-200"
  >
    <Sparkles className="h-4 w-4 text-virgilio-purple shrink-0" />
    <span className="text-sm text-virgilio-purple font-semibold">AI Notes Analysis Available</span>
  </button>
</div>
```

Key details:
- **Outer wrapper**: `rounded-lg` (matches app buttons) + `p-[2px]` gradient background
- **Inner button**: `rounded-[6px]` (slightly smaller to reveal gradient), `bg-card` for transparent/white interior matching the page background
- **Hover**: gradient opacity increases, inner bg gets subtle `bg-accent/10` tint
- **Text/icon**: purple (`text-virgilio-purple`) with semibold weight — unchanged


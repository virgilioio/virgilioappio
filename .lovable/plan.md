

# Fix Multicolor Gradient Border on AI Analysis Button

## Problem
The current approach uses `-z-10` on the gradient `span` combined with `overflow-hidden` on the button. The `overflow-hidden` clips the gradient pseudo-element that extends to `inset-[-2px]`, and the `-z-10` stacking can cause it to render behind the button's own background, making it barely visible or glitchy.

## Solution
Replace the single-element approach with a **wrapper pattern**: an outer `div` with the gradient background, and the button content inside with a slightly inset background that reveals the gradient as a border.

### `src/components/candidates/ExpandableScoreDisplay.tsx` (lines 43-55)

Replace with:
```tsx
<div className="rounded-lg p-[2px] bg-gradient-to-r from-purple-400 via-pink-400 to-blue-400 opacity-80 hover:opacity-100 transition-opacity group">
  <button
    type="button"
    onClick={() => firstAiDraft && onOpenFullSheet?.(firstAiDraft.id)}
    className="flex items-center gap-2 w-full text-left px-3 py-2.5 rounded-[6px] bg-pastel-purple/30 group-hover:bg-pastel-purple/40 transition-all duration-200"
  >
    <Sparkles className="h-4 w-4 text-virgilio-purple shrink-0" />
    <span className="text-sm text-virgilio-purple font-semibold">AI Notes Analysis Available</span>
  </button>
</div>
```

This is a reliable CSS pattern: the outer wrapper has gradient background + `p-[2px]` padding, and the inner button has its own opaque background with a slightly smaller border-radius, creating a clean 2px gradient border that's always visible.


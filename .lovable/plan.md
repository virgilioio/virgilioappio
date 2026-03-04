

# Fix: AI Notes Analysis Scrollable Content

## Problem
The `ScrollArea` wrapping the AI analysis content has `max-h-80` on the Radix Root element, but the inner Viewport doesn't inherit the height constraint. This means long analysis text overflows without a scrollbar.

## Fix — `ScorecardSheet.tsx` (line 1009)

Replace the `ScrollArea` with a simple `div` that has `overflow-y-auto` and `max-h-80`. This is more reliable than fighting with Radix ScrollArea's height propagation:

```tsx
// Before
<ScrollArea className="max-h-80">
  <SafeHtml ... />
</ScrollArea>

// After
<div className="max-h-80 overflow-y-auto pt-3">
  <SafeHtml ... />
</div>
```

This gives a native scrollbar when the content exceeds 320px (20rem), which is sufficient for reading while keeping the banner compact. The `pt-3` adds a small top padding after the border separator.

Single line change, no other files affected.


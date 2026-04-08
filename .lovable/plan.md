

# Fix: Time Picker Scroll Not Working with Mouse Wheel

## Root Cause

The Radix `ScrollArea` component uses `overflow: hidden` on its root and manages scrolling via its own `Viewport`. However, inside a Popover (which is rendered in a portal), the Radix ScrollArea often blocks native wheel/touch scroll events — users can only scroll by dragging the scrollbar handle.

## Solution

Replace the `ScrollArea` wrapper in `TimePickerVirgilio` with a plain `div` that uses native `overflow-y: auto` scrolling. This is simpler and reliably supports mouse wheel, trackpad, and touch scrolling inside popovers.

In `src/components/ui/time-picker-virgilio.tsx` (line 119):

**Before:**
```tsx
<ScrollArea className="h-[300px] pr-3">
```

**After:**
```tsx
<div className="h-[300px] overflow-y-auto pr-3">
```

And update the closing tag accordingly. Remove the `ScrollArea` import since it's no longer used.

## Files changed

| File | Change |
|------|--------|
| `src/components/ui/time-picker-virgilio.tsx` | Replace `ScrollArea` with native scrollable `div`; remove unused import |


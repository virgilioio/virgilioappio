
# Fix Notification Center Scrolling

## Problem

Two issues with the notification popover:
1. **Horizontal scroll** — The Radix `ScrollArea` component applies `min-width: fit-content` on its viewport, preventing content from shrinking to fit the popover width
2. **Vertical scroll not working** — The `ScrollArea` needs an explicit height to enable scrolling, and the current `max-h-80` on the wrapper isn't propagating correctly

## Solution

### File: `src/components/layout/NotificationCenter.tsx`

Replace the `ScrollArea` component with a plain `div` using `overflow-y-auto max-h-80`. This follows the established project pattern (per style guide) where narrow panels use native scrolling instead of Radix ScrollArea to avoid the `min-width: fit-content` issue.

**Changes:**
- Remove the `ScrollArea` import
- Replace `<ScrollArea className="max-h-80">` with `<div className="overflow-y-auto max-h-80">`
- Close with `</div>` instead of `</ScrollArea>`

This is a 3-line change that fixes both the horizontal overflow and vertical scrolling.

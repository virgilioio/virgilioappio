

# Fix Vertical Centering in Minimized Offer Composer

The header bar uses `p-4` (16px padding all sides) which, combined with the text/icon heights, doesn't perfectly center within the fixed `h-[52px]`. When minimized, the `border-b` is also unnecessary.

## Change: `src/components/candidates/MinimizableOfferComposer.tsx`

On the header `div` (line 111), conditionally adjust styling when minimized:
- When minimized: use `h-full` to fill the 52px container, remove `border-b` and `rounded-t-lg` (it's the only visible element so round all corners), and use `px-4` with flex centering handling the vertical alignment
- When expanded: keep current `p-4 border-b rounded-t-lg`

This ensures `items-center` properly vertically centers content against the full 52px height.


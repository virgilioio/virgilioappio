

# Make SavedSearchSelector Match the Views Chip Style

## Problem

The "Select a search..." dropdown in the Find page uses a standard rectangular `Button variant="outline"` while every other page uses the pill-shaped chip pattern (`rounded-full border px-3 h-8 text-sm font-poppins font-medium`).

## Change

**`src/components/sourcing/SavedSearchSelector.tsx`** — Replace the `<Button variant="outline">` trigger with a styled `<button>` matching the SavedViewSelector chip exactly:

- `rounded-full border px-3 h-8 text-sm font-poppins font-medium whitespace-nowrap`
- `hover:bg-accent/30`
- Active state: `bg-accent/40 border-accent-foreground/20 text-accent-foreground`
- Inactive state: `border-border text-muted-foreground hover:text-foreground`
- Icon: keep the `ChevronDown` at `h-3 w-3 opacity-60` (matching Views chip)
- Add a `Bookmark` or `Search` icon (h-3.5 w-3.5) on the left to mirror the Views chip's `Bookmark` icon
- Label: show project name when selected, "Searches" when not (mirrors "Views" label)
- Remove `max-w-[300px]` and the `justify-between` layout — chips don't use those

## Files

| File | Change |
|------|--------|
| `src/components/sourcing/SavedSearchSelector.tsx` | Restyle trigger button to match SavedViewSelector chip pattern |


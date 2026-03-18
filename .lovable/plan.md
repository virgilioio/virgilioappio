

# Fix Pipeline JobRow Horizontal Overflow on Mobile

**Problem**: The flex container on line 47 has `min-w-0` but the parent chain doesn't properly constrain width. The `h3` has `truncate` but the outer wrapper (`flex items-center justify-between w-full`) combined with the accordion structure allows the row to exceed viewport width when titles are long.

**Fix in `src/components/pipeline/JobRow.tsx`**:

1. **Line 44**: Add `overflow-hidden` to the outer flex div: `flex items-center justify-between w-full pr-2` → `flex items-center justify-between w-full pr-2 overflow-hidden`

2. **Line 47**: Add `overflow-hidden` to the title+badge row: `flex items-center gap-2 min-w-0` → `flex items-center gap-2 min-w-0 overflow-hidden`

This ensures the title truncates properly and the badge stays visible without pushing content beyond the viewport.

| File | Change |
|---|---|
| `src/components/pipeline/JobRow.tsx` | Add `overflow-hidden` to lines 44 and 47 |


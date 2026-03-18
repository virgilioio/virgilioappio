

# Fix Build Error + Responsive Stage Column Width

## 1. Build Error Fix (TS17002 at line 1254)

The `</ScrollArea>` at line 1254 is being interpreted as mismatched with an unclosed `<div>`. The structure visually appears balanced, but the compiler disagrees — likely a corruption from prior edits. The fix is to **rewrite the `<CardContent>` block** (lines 1094–1255) in the mobile section cleanly, consolidating the mobile board view and ScrollArea into a single, properly structured block. The same treatment applies to the duplicate desktop section (lines 1487–1636).

**Approach**: Remove the separate mobile-board `<div>` block (lines 1096–1111) and the conditional hiding on the `<ScrollArea>` (line 1113). Instead, use a single conditional: if `recruiting + board` on mobile, render `PipelineOverview` in a native-scroll container; otherwise render the `ScrollArea` for everything else. This simplifies the JSX nesting and eliminates the tag-balancing issue.

## 2. Responsive Stage Column Width

The `w-[85vw]` in `PipelineOverview.tsx` (line 588) doesn't account for the parent container's padding, causing the card to either overflow slightly or leave awkward gaps depending on the device.

**Fix in `PipelineOverview.tsx`**: Change `w-[85vw]` to `w-[calc(100vw-3rem)]` on mobile. This accounts for the layout container padding (~1.5rem on each side) and ensures the card fills the available space naturally, with just enough room to hint at the next stage. Keep `sm:w-72` for desktop.

## Files to Edit

| File | Change |
|---|---|
| `src/pages/JobDetail.tsx` | Rewrite CardContent blocks (mobile ~1094-1255, desktop ~1487-1636) to fix JSX mismatch |
| `src/components/jobs/PipelineOverview.tsx` | Change `w-[85vw]` → `w-[calc(100vw-3rem)]` on line 588 |


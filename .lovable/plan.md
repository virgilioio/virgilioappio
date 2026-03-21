

# Fix Find Page: Sidebar and Table Must Not Grow — Internal Scroll Only

## Root Cause

The parent `Layout.tsx` renders `<main className="min-h-screen sm:min-h-[calc(100vh-3.5rem)]">` — this is a **min-height** container, not a **fixed-height** container. When the sidebar filter sections expand, the content naturally pushes the `<main>` taller, causing the whole page to scroll.

The Find page tries to contain itself with `h-full min-h-0 flex flex-col overflow-hidden`, but `h-full` resolves to nothing meaningful because the parent `<main>` has no fixed height — it only has a min-height.

The sidebar Card already has `overflow-y-auto` on its inner div, which is correct. But it never activates because the card's height is never constrained — it just grows with the page.

## Fix

### 1. `src/pages/Find.tsx` — Use viewport-based fixed height instead of `h-full`

The outermost wrapper should use a calculated fixed height that accounts for the header (3.5rem on desktop). Replace the `h-full` approach with explicit viewport height:

```
<div className="h-[100dvh] sm:h-[calc(100dvh-3.5rem)] flex flex-col overflow-hidden">
```

This gives the Find page a hard pixel height that doesn't depend on the parent `<main>` having a fixed height. Everything inside is already correctly set up with `flex-1 min-h-0 overflow-hidden` chains — they just need an ancestor with an actual fixed height.

Also change the inner flex container from `py-6` to `pt-4 pb-4` (or keep `py-6`) — doesn't matter as long as the height is fixed. The `h-full` on the inner `<div className="flex gap-6 py-6 h-full min-h-0 overflow-hidden">` will now resolve correctly.

### 2. No changes needed to `FindFilterPanel.tsx`

The sidebar already has `h-full shrink-0 flex flex-col min-h-0 overflow-hidden` on the Card, and `flex-1 min-h-0 overflow-y-auto` on the scrollable content div. Once the parent provides a real height constraint, internal scroll will work.

### 3. No changes needed to `SourcingProjectView.tsx` or the right-side Card

The right-side Card already has `flex-1 flex flex-col min-h-0 overflow-hidden` and inner content has `flex-1 min-h-0 overflow-hidden`. Same story — needs a real height ancestor, which fix #1 provides.

## Files

| File | Change |
|------|--------|
| `src/pages/Find.tsx` | Replace `h-full` with explicit viewport-based height on outermost container |

One line change. The entire overflow chain is already correct — it was just missing a real height anchor at the top.


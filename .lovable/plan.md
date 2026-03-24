

# Fix Job Setup Tab Scrolling

## Problem

The outer page layout uses `overflow-hidden` from the root all the way down through the Tabs container. The **Pipeline tab** correctly has `className="flex-1 min-h-0 flex flex-col overflow-hidden"` with an inner `overflow-auto` div, allowing its content to scroll. But the **Job Setup tab** (desktop, line 1680) has no overflow or flex classes at all — its content overflows the fixed viewport and gets clipped with no scrollbar.

## Fix

**`src/pages/JobDetail.tsx`** — Desktop job-setup TabsContent (line 1680)

Add `className="flex-1 min-h-0 overflow-auto"` to the TabsContent so it becomes a scroll container within the fixed-height layout:

```tsx
// Before
<TabsContent value="job-setup">

// After
<TabsContent value="job-setup" className="flex-1 min-h-0 overflow-auto">
```

Apply the same fix to the **mobile** job-setup TabsContent (line 825):

```tsx
// Before
<TabsContent value="job-setup">

// After
<TabsContent value="job-setup" className="flex-1 min-h-0 overflow-auto">
```

## Files

| File | Change |
|------|--------|
| `src/pages/JobDetail.tsx` | Add `flex-1 min-h-0 overflow-auto` to both desktop (line 1680) and mobile (line 825) job-setup TabsContent |


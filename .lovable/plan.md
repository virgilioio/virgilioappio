

# Fix Blank Space Above Job Setup Content

## Problem

The `flex-1 min-h-0` added to the job-setup `TabsContent` is causing the container to stretch to fill the entire available height of the flex column parent. The `JobSetupPanel` content then renders at its natural size within that stretched container, leaving a large blank space. This flex behavior is unnecessary for the job-setup tab — unlike the pipeline tab (which has a board that needs to fill the viewport), the setup tab just needs to scroll its content naturally.

## Fix

**`src/pages/JobDetail.tsx`** — Remove `flex-1 min-h-0` from both desktop and mobile job-setup TabsContent. Keep only `overflow-auto` for scrolling:

Desktop (line 1680):
```tsx
// Before
<TabsContent value="job-setup" className="flex-1 min-h-0 overflow-auto">

// After
<TabsContent value="job-setup" className="overflow-auto">
```

Mobile (line 825):
```tsx
// Before
<TabsContent value="job-setup" className="flex-1 min-h-0 overflow-auto">

// After
<TabsContent value="job-setup" className="overflow-auto">
```

The parent flex-col container already constrains the height. `overflow-auto` alone will enable scrolling when content exceeds the viewport, without stretching the container and creating blank space.

## Files

| File | Change |
|------|--------|
| `src/pages/JobDetail.tsx` | Remove `flex-1 min-h-0` from both job-setup TabsContent elements (lines 825 and 1680) |


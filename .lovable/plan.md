

# Fix JobDetail Page Scroll — Apply Fixed Viewport Layout

## Problem

The JobDetail page root uses `min-h-screen` which allows content to grow beyond the viewport, causing a full-page scroll. Other pages (Jobs, Candidates, Pipeline, Find) already use the fixed viewport pattern (`h-[100dvh] sm:h-[calc(100dvh-3.5rem)]` + `flex flex-col overflow-hidden`) so their content scrolls internally.

## Fix

**`src/pages/JobDetail.tsx`** — Line 784

Change the outer container from document-flow to fixed viewport:

```tsx
// Before
<div className="min-h-screen bg-background overflow-x-hidden">
  <div className="layout-container pt-1 pb-4 sm:pt-2 sm:pb-6 lg:pt-3 lg:pb-8">

// After
<div className="h-[100dvh] sm:h-[calc(100dvh-3.5rem)] flex flex-col bg-background overflow-hidden">
  <div className="layout-container pt-1 pb-2 sm:pt-2 sm:pb-3 flex-1 min-h-0 flex flex-col overflow-hidden">
```

Then ensure the `Tabs` component and its active `TabsContent` also participate in flex layout (`flex-1 min-h-0 overflow-hidden` / `overflow-auto` as needed) so the pipeline kanban and other tab contents scroll internally rather than pushing the page.

The pipeline tab already has `h-[calc(100svh-16rem)]` — this can be replaced with `flex-1 min-h-0` since the parent will now constrain it properly.

## Files

| File | Change |
|------|--------|
| `src/pages/JobDetail.tsx` | Apply fixed viewport height to root; make inner layout flex-col with min-h-0; remove hardcoded calc heights on pipeline tab |


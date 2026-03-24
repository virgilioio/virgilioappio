

# Fix Job Setup Whitespace — CSS Specificity Bug

## Root Cause

The Pipeline tab's `TabsContent` has `className="flex-1 min-h-0 flex flex-col overflow-hidden"`. The `flex` class sets `display: flex`.

When a non-pipeline tab is active, Radix marks inactive TabsContent elements with the HTML `[hidden]` attribute, which sets `display: none`. But Tailwind's `.flex { display: flex }` utility has the **same CSS specificity** as the Preflight's `[hidden] { display: none }` — and utilities come **later** in the stylesheet, so `.flex` wins.

Result: the Pipeline TabsContent **never actually hides**. It stays `display: flex` with `flex-1`, consuming the majority of the parent's height as an invisible empty container. Other tabs' content gets pushed below it.

Why Hiring Team looks fine: its content is long enough that the total content exceeds the viewport height. When content overflows, `flex-grow` has no extra space to distribute, so Pipeline's empty div collapses to ~0. But for short-content tabs (Overview, Job Postings), the Pipeline div grabs all the spare height, pushing the visible content to the bottom.

## Fix

Remove `flex flex-col` from Pipeline's `TabsContent` className. This stops the `display: flex` from overriding `[hidden]`. Keep `flex-1 min-h-0 overflow-hidden` (these affect it as a flex item, not a flex container). Change the inner wrapper div from `flex-1` to `h-full` since its parent is no longer a flex container.

**`src/pages/JobDetail.tsx`** — Desktop (line 1326-1327):

```tsx
// Before
<TabsContent value="pipeline" className="flex-1 min-h-0 flex flex-col overflow-hidden">
  <div className="flex-1 min-h-0 overflow-auto">

// After
<TabsContent value="pipeline" className="flex-1 min-h-0 overflow-hidden">
  <div className="h-full overflow-auto">
```

Mobile pipeline tab (line 838) has no `flex` class on TabsContent, so it's not affected.

## Files

| File | Change |
|------|--------|
| `src/pages/JobDetail.tsx` | Remove `flex flex-col` from Pipeline TabsContent; change inner div from `flex-1 min-h-0` to `h-full` |

## What stays untouched
- Non-pipeline tabs (Job Dashboard, All Candidates, Job Setup) — no changes
- Pipeline content, business logic, scroll behavior — unchanged
- Mobile layout — not affected (no `flex` class on mobile pipeline TabsContent)


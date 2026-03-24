

# Fix Job Setup White Space and Scrolling

## Root Cause

The layout hierarchy is: `Tabs(flex-col, flex-1, overflow-hidden)` → `div(flex-1, flex-col)` → `TabsContent`. The Pipeline tab works correctly because it uses a **two-layer pattern**:

```text
TabsContent (flex-1, min-h-0, flex flex-col, overflow-hidden)  ← fills space, no scroll
  └─ div (flex-1, min-h-0, overflow-auto)                      ← inner scroll container
       └─ content
```

The job-setup tab currently has just `overflow-auto` on the TabsContent — which does nothing because there's no height constraint. Previously, adding `flex-1 min-h-0 overflow-auto` directly on TabsContent caused blank space due to the overflow container interacting poorly with flex sizing.

The fix is to mirror the Pipeline's two-layer approach: TabsContent fills the space and clips, inner div scrolls.

## Fix

**`src/pages/JobDetail.tsx`** — Both desktop (line 1680) and mobile (line 825):

```tsx
// Before
<TabsContent value="job-setup" className="overflow-auto">
  <JobSetupPanel ... />
</TabsContent>

// After
<TabsContent value="job-setup" className="flex-1 min-h-0 flex flex-col overflow-hidden">
  <div className="flex-1 min-h-0 overflow-auto">
    <JobSetupPanel ... />
  </div>
</TabsContent>
```

This exactly matches how the Pipeline tab handles its layout — the TabsContent fills available height without scrolling, and the inner div provides the scroll container.

## Files

| File | Change |
|------|--------|
| `src/pages/JobDetail.tsx` | Wrap JobSetupPanel in scroll div; update TabsContent classes on lines 825 and 1680 |


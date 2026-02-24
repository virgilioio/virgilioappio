

# Fix: AI Draft Popover Closing Immediately on Interaction

## Root Cause

The `AIDraftPopover` uses a Radix `Popover` component, which portals its content to the document body. When the EmailComposer is rendered inside a Radix `Sheet` (as it is in `CandidateProfileSheet` and `IndependentCandidateProfileSheet`), the Sheet's modal behavior detects clicks on the portaled Popover content as "outside" clicks, causing the Popover to dismiss immediately.

This is a known interaction issue between nested Radix primitives (Popover inside Sheet/Dialog) when the inner component uses a portal.

## The Fix

**File:** `src/components/candidates/AIDraftPopover.tsx`

Add `modal={true}` to the `Popover` component. This tells Radix to properly trap interactions within the popover, preventing the parent Sheet from intercepting clicks on the popover content.

```tsx
// Before
<Popover open={open} onOpenChange={...}>

// After
<Popover open={open} onOpenChange={...} modal={true}>
```

This is a one-line change. No other files need modification.

## Why This Works

When `modal={true}`:
- Radix adds a dismiss layer that properly captures pointer events
- Clicks inside the popover content are no longer propagated to the parent Sheet's outside-click handler
- The popover behaves as expected: clicks on badges, textarea, and buttons all work without dismissing


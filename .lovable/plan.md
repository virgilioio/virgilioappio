

# Fix: Close Notification Popover on Click

## Problem
Clicking a notification navigates but doesn't close the popover, leaving it overlaying the page.

## Fix
**File:** `src/components/layout/NotificationCenter.tsx`

Add controlled `open` state to the `Popover` component. Set it to `false` inside `handleNotificationClick` before navigating.

```typescript
const [open, setOpen] = useState(false)

// In handleNotificationClick:
setOpen(false)

// On Popover:
<Popover modal={true} open={open} onOpenChange={setOpen}>
```

Single file change, ~5 lines added.


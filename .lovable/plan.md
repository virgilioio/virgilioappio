

# Smooth Collapsible Calendar Animation + Dynamic Date Size

## Changes

### File: `src/components/dashboard/UpcomingActivities.tsx`

1. **Smooth expand/collapse animation**: Add `className="overflow-hidden data-[state=open]:animate-collapsible-down data-[state=closed]:animate-collapsible-up"` to `CollapsibleContent` (these animations already exist in tailwind.config.ts).

2. **Dynamic date size**: When collapsed, render the date with `PageTitle as="h3"`. When expanded, render with `PageTitle as="h4"` (current size). Add a CSS transition on the wrapper for smooth scaling:

```tsx
<div className={cn(
  "transition-all duration-300 ease-out origin-left",
  calendarOpen ? "scale-100" : "scale-[1.15]"
)}>
  <PageTitle as="h4">
    {format(currentMonth, 'MMMM d, yyyy')}
  </PageTitle>
</div>
```

This uses `transform: scale()` which transitions smoothly rather than switching between discrete font sizes (which can't animate). The date appears ~15% larger when collapsed and smoothly shrinks when expanded.

## Files changed

| File | Change |
|------|--------|
| `src/components/dashboard/UpcomingActivities.tsx` | Add collapsible animation classes to `CollapsibleContent`, wrap `PageTitle` in a scaling container that transitions based on `calendarOpen` state |


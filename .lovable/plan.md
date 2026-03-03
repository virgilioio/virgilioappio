

# Fix Notification Sort Order

## Problem
In `src/hooks/usePendingActivities.ts` line 62-65, activities are sorted **oldest first** (`a - b`). The NotificationCenter displays them in this order, putting newest notifications at the bottom.

## Fix
**File:** `src/hooks/usePendingActivities.ts` — line 62-65

Change the sort comparator from ascending to descending:

```typescript
// Before (oldest first):
return activities.sort((a, b) => 
  new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
);

// After (newest first):
return activities.sort((a, b) => 
  new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
);
```

Single line change — swap `a` and `b` in the sort. This fixes ordering in both the NotificationCenter popover and the PendingActivities dashboard widget.




# Fix: "subscribe multiple times" Error in UpcomingActivities

## Root Cause

The Supabase realtime channel uses a static name `'booking-sync-notifications'`. When the component remounts (React strict mode, or HMR), the previous channel instance may not be fully cleaned up before a new subscription attempt happens on the same channel name.

## Fix

**File: `src/components/dashboard/UpcomingActivities.tsx` (lines 185-225)**

Make the channel name unique per mount by appending a timestamp or random suffix:

```ts
const channelName = `booking-sync-notifications-${Date.now()}`
const channel = supabase
  .channel(channelName)
  // ... rest stays the same
```

This ensures each mount gets a fresh channel instance, avoiding the "subscribe multiple times" error. The cleanup function already calls `supabase.removeChannel(channel)` which will properly dispose of each unique instance.

## Files changed

| File | Change |
|------|--------|
| `src/components/dashboard/UpcomingActivities.tsx` | Use unique channel name per mount |


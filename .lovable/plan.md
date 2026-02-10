

# Fix: Remove Unnecessary `useUserProfile` from `usePermissions`

## Root Cause

In `src/hooks/usePermissions.ts` (line 6), `useUserProfile()` is called and destructured:

```ts
const { profile } = useUserProfile()
```

But `profile` is **never used** anywhere in the hook. All permission logic derives from `useAuth()` and `useIsPlatformAdmin()`. This unnecessary hook call:
- Creates extra `useState`/`useEffect` calls inside every component that uses `usePermissions`
- These extra React fibers lose their update queue during HMR, causing the "Should have a queue" crash
- Since `usePermissions` is called from many dashboard components (`useStaleCandidates`, `useDashboardReminders`, `usePendingActivities`, `StaleCandidates`, `UpcomingActivities`, etc.), the crash triggers frequently

## Fix

Remove the `useUserProfile` import and call from `usePermissions.ts`. Two lines to change:

1. Delete the import: `import { useUserProfile } from '@/hooks/useUserProfile'`
2. Delete the call: `const { profile } = useUserProfile()`

No other code in the hook references `profile`, so nothing else needs to change.

## Files Modified

| File | Change |
|------|--------|
| `src/hooks/usePermissions.ts` | Remove unused `useUserProfile` import and call |

Two-line deletion fix.


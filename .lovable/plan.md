

# Fix Job Title Disappearing on Hiring Plan Tab Switch

## Root Cause

The `useQuery` for job data in `JobDetail.tsx` (line 532) has no `staleTime` or data preservation configuration. When the user navigates to the Hiring Plan sub-tab:

1. The `HiringPlanTab` mounts, calling `useJobStages()` which internally calls `supabase.auth.getUser()` (a network request)
2. If the JWT needs refreshing, this triggers a `TOKEN_REFRESHED` auth event
3. The auth bootstrap re-runs, potentially briefly setting `orgContext` to `null`
4. This causes the `useJobs()` hook (also instantiated in JobDetail) to re-run its effects due to dependency changes (`organizationId`, `userType`)
5. The cascade of state updates and re-renders causes the job query to refetch
6. During refetch, since there's no `placeholderData` or `keepPreviousData`, `job` can momentarily become `undefined`
7. The guard `if (!job) return null` at line 826 blanks the entire page
8. When data returns, it may re-render differently, and switching back to Overview shows fallback "Not specified" values because the query may have been disrupted

## Fix (3 changes in `JobDetail.tsx`)

### 1. Add `staleTime` and `placeholderData` to the job query

At the `useQuery` call (line 532), add configuration to keep data stable:

```typescript
const { data: job, isLoading: jobLoading, error, refetch } = useQuery({
  queryKey: ['job', id],
  queryFn: async () => { ... },
  enabled: !!id && !!user,
  staleTime: 5 * 60 * 1000,           // 5 minutes - prevents refetches on tab switches
  placeholderData: (previousData) => previousData,  // Keep previous data during refetch
})
```

- `staleTime: 5 * 60 * 1000` prevents the query from being considered stale for 5 minutes, avoiding unnecessary refetches when switching between sub-tabs
- `placeholderData: (prev) => prev` ensures the previous job data is retained while a refetch is in progress, so `job` never becomes `undefined` mid-render

### 2. Make the null guard less aggressive

Change line 826 from:
```typescript
if (!job) return null
```
to:
```typescript
if (!job) return (
  <div className="min-h-screen bg-background">
    <div className="container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8">
      <Skeleton className="h-12 w-64 mb-4" />
      <div className="grid grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    </div>
  </div>
)
```

This prevents a full blank screen flash if `job` is ever briefly undefined. Instead, users see a quick skeleton placeholder.

## Files to modify

- `src/pages/JobDetail.tsx` -- add staleTime, placeholderData to useQuery; improve null guard

## Impact

- Job title and all job data will remain visible when switching between sub-tabs within Job Setup
- No more "Not specified" fallbacks when returning to the Overview tab
- The fix is purely defensive and doesn't change any data flow or business logic

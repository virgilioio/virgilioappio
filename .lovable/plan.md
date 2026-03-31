

# Fix: Frontend Request Storm from Onboarding Progress

## Root cause

**Infinite render loop in `OnboardingChecklist`**: `refreshProgress` is a plain async function (not wrapped in `useCallback`), so it gets a new reference on every render. The `useEffect([refreshProgress])` fires on every render, which calls the RPC, invalidates the query, triggers a re-render, which creates a new `refreshProgress`, which triggers the effect again — infinite loop.

Additionally, 5 other hooks (`useCandidates`, `useJobs`, `useMembers`, `useOrganizations`, `useMailIdentities`) each independently call `supabase.auth.getUser()` + query `members` + call the same `check_onboarding_task_completion` RPC after every mutation. That's 3 extra requests per mutation, duplicated across hooks.

## Fix plan

### 1. Stabilize `refreshProgress` in `useOnboardingProgress.ts`

Wrap `refreshProgress` in `useCallback` with `[user?.id, tenantId]` dependencies. This stops the infinite loop immediately.

### 2. Remove the `useEffect` trigger in `OnboardingChecklist.tsx`

Delete the `useEffect(() => { refreshProgress() }, [refreshProgress])` block entirely. React Query already fetches on mount via `useQuery`. The RPC should only run on explicit user actions (mutations), not on every mount/re-render.

### 3. Consolidate RPC calls in mutation hooks

In `useCandidates.ts`, `useJobs.ts`, `useMembers.ts`, `useOrganizations.ts`, and `useMailIdentities.ts`: replace the 10-line inline RPC block (getUser → query members → call RPC → invalidate) with a single call to a shared helper that uses cached auth/tenant data and deduplicates concurrent calls.

Create a small utility `src/utils/refreshOnboardingProgress.ts`:
- Accepts `queryClient`, `userId`, `tenantId`
- Calls the RPC once
- Invalidates `['onboarding-progress']`
- Uses an in-flight guard ref to prevent duplicate concurrent calls

Then each mutation hook just calls `refreshOnboardingProgress(queryClient, user.id, tenantId)` instead of the full inline block.

## Files changed

| File | Change |
|------|--------|
| `src/hooks/useOnboardingProgress.ts` | Wrap `refreshProgress` in `useCallback` |
| `src/components/dashboard/OnboardingChecklist.tsx` | Remove the `useEffect` that calls `refreshProgress` on mount |
| `src/utils/refreshOnboardingProgress.ts` | New shared helper with in-flight guard |
| `src/hooks/useCandidates.ts` | Replace inline RPC block with shared helper call |
| `src/hooks/useJobs.ts` | Same |
| `src/hooks/useMembers.ts` | Same |
| `src/hooks/useOrganizations.ts` | Same |
| `src/hooks/useMailIdentities.ts` | Same |


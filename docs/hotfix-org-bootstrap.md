# Resilient Organization Context Bootstrap

## Problem

Users experienced infinite loading spinners and repeated "Failed to resolve org context" errors during:
- Tab switches
- Hard page refreshes  
- Network fluctuations
- Initial app load

**Root causes:**
1. Auth listener triggered on every `INITIAL_SESSION` event (noisy, unnecessary)
2. No caching - every bootstrap made a fresh DB call
3. No retry logic or timeout handling
4. Slow/failed `resolve_org_context()` calls blocked the entire UI

## Solution

### 1. Event Filtering
**File:** `src/hooks/useAuthBootstrap.ts`

Only react to meaningful auth events:
- ✅ `SIGNED_IN` - User just logged in
- ✅ `TOKEN_REFRESHED` - Session token refreshed
- ✅ `USER_UPDATED` - User metadata changed
- ✅ `SIGNED_OUT` - User logged out
- ❌ `INITIAL_SESSION` - Ignored (just initial render, handled by mount)

### 2. Cache-First Loading
**File:** `src/lib/orgContextCache.ts`

- Cache org context in `localStorage` with 24-hour TTL
- Bind to `user_id` to prevent cross-user contamination
- On bootstrap:
  1. Check cache → Instant UI hydration
  2. Verify in background → Silent update if changed
  3. Show toast only if context actually changed

### 3. Resilient Resolution
**File:** `src/lib/authUtils.ts` - `resolveOrgContextWithRetry()`

- 3 retry attempts with exponential backoff
- 8-second timeout per attempt
- `AbortController` support for cleanup
- Fallback to cached context on failure

### 4. Debouncing
**File:** `src/utils/debounce.ts`

- 150ms debounce on auth state changes
- Prevents rapid duplicate bootstraps

## Behavior

### Happy Path (Cached)
```
User refreshes page
└─ [0ms] Read cache → Instant UI with org context
└─ [Background] Verify context → Silent update if needed
```

### Happy Path (No Cache)
```
User logs in
└─ [0ms] Show loading spinner
└─ [~500ms] Resolve org context → UI ready
└─ [500ms] Write to cache
```

### Slow Network
```
User on 3G connection
└─ [0ms] Read cache → Instant UI
└─ [Background] Attempt 1 fails (8s timeout)
└─ [Background] Attempt 2 retries (+300ms backoff)
└─ [Background] Attempt 3 succeeds → Silent cache update
```

### Network Failure
```
User offline
└─ [0ms] Read cache → Instant UI with stale context
└─ [Background] All 3 attempts fail
└─ [Toast] "Using cached workspace data. Retrying in background."
```

## Testing

### Test 1: Hard Refresh (with cache)
1. Log in and navigate around
2. Hard refresh (Ctrl+Shift+R)
3. **Expected:** UI renders instantly with cached org, no spinner

### Test 2: Tab Switch
1. Open app in Tab A
2. Open app in Tab B
3. Switch between tabs
4. **Expected:** No re-bootstrap, no "INITIAL_SESSION" logs

### Test 3: Slow Network
1. Open DevTools → Network → Throttle to "Fast 3G"
2. Hard refresh
3. **Expected:** UI shows cached context immediately, background verify runs

### Test 4: Sign Out/In
1. Sign out
2. Sign back in with different user
3. **Expected:** Cache cleared, fresh bootstrap runs, correct user context

### Test 5: Context Change
1. Admin changes your org assignment in DB
2. Hard refresh
3. **Expected:** 
   - UI shows old cached context first
   - Background verify detects change
   - Toast: "Workspace context updated"
   - UI updates to new context

## Database Performance (Optional)

Add indexes to speed up `resolve_org_context()`:

```sql
CREATE INDEX IF NOT EXISTS idx_members_user_id ON members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_org_id ON members(organization_id);
CREATE INDEX IF NOT EXISTS idx_members_status ON members(user_status);
```

Verify function signature:
```sql
CREATE OR REPLACE FUNCTION resolve_org_context()
RETURNS TABLE(organization_id uuid, role text, user_type text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO public, pg_temp
AS $$...$$;
```

## Logging

Minimal, actionable logs (development only):

```
🔐 Bootstrap start (initial mount)
🔐 Bootstrap using cached org context { orgId: '...', role: '...' }
✅ Org context resolved in 245ms { orgId: '...', role: '...' }
⚠️ Org context verify failed: timeout
🔐 Auth state change: SIGNED_IN
```

## Files Modified

- ✅ `src/lib/orgContextCache.ts` (new)
- ✅ `src/utils/debounce.ts` (new)
- ✅ `src/lib/authUtils.ts` (added `resolveOrgContextWithRetry`)
- ✅ `src/hooks/useAuthBootstrap.ts` (cache-first, event gating)
- ✅ `docs/hotfix-org-bootstrap.md` (this file)

## No Breaking Changes

- RLS policies unchanged
- Auth flows unchanged
- `resolve_org_context()` RPC unchanged
- API contracts preserved
- Existing functionality intact

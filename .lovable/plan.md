

# Fix Duplicate Dashboard Cards + Subscribe Error

## Root Cause

`loadLayout()` in `useDashboardLayout.ts` validates that each card ID is a known ID, but **never deduplicates across columns**. If localStorage contains `onboarding` in both `left` and `center`, both copies are kept. This causes:

1. React warns about duplicate keys in the grid
2. The `agenda` card mounts twice, both instances create a Supabase channel with `Date.now()` in the same tick → identical channel name → "subscribe multiple times" crash

## Fix

### 1. `src/hooks/useDashboardLayout.ts` — Deduplicate in `loadLayout()`

After filtering valid IDs for each column and hidden list, walk them in order (left → center → right → hidden) and skip any ID already seen. This ensures each card appears exactly once.

```ts
// After validLeft/validCenter/validRight/validHidden are built:
const seen = new Set<DashboardCardId>()
const dedup = (arr: DashboardCardId[]) => 
  arr.filter(id => { if (seen.has(id)) return false; seen.add(id); return true })

const dedupLeft = dedup(validLeft)
const dedupCenter = dedup(validCenter)
const dedupRight = dedup(validRight)
const dedupHidden = dedup(validHidden)
```

Then use the deduped arrays for the rest of the function (missing card check, return value).

### 2. `src/components/dashboard/UpcomingActivities.tsx` — Use `useRef` for channel ID

Replace `Date.now()` with `crypto.randomUUID()` stored in a `useRef` so it's guaranteed unique even if two instances mount in the same tick.

```ts
const channelIdRef = useRef(crypto.randomUUID())
// ...
const channel = supabase.channel(`booking-sync-${channelIdRef.current}`)
```

## Files changed

| File | Change |
|------|--------|
| `src/hooks/useDashboardLayout.ts` | Add deduplication pass in `loadLayout()` |
| `src/components/dashboard/UpcomingActivities.tsx` | Use `crypto.randomUUID()` via `useRef` for channel name |


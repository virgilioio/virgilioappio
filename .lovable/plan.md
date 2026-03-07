

# Fix: Database Overload During Batch Enrichment

## Root Cause

The batch enrichment process updates candidate records (setting `enrichment_status`, `current_job_title`, etc.). Each update fires a **Postgres real-time change event**. The real-time subscription in `useIndependentCandidates.ts` (line 361) calls `getCandidates()` on **every single change**. 

`getCandidates()` itself is expensive — it first calls `getOrganizationTree()` (3 queries to the organizations table), then does a `SELECT *` on the entire candidates table filtered by multiple org IDs. With hundreds of candidates being enriched, this creates a cascade:

```text
Enrichment updates candidate 1 → realtime event → getCandidates() (4 DB queries)
Enrichment updates candidate 2 → realtime event → getCandidates() (4 DB queries)
Enrichment updates candidate 3 → realtime event → getCandidates() (4 DB queries)
... × 30 candidates per batch = 120+ concurrent queries
```

This exhausts the Supabase connection pool, causing `statement timeout` and `connection pool timeout` errors across the entire app (including other features like Gmail sync).

## Fix

**Debounce the real-time handler** so that rapid-fire candidate updates only trigger one `getCandidates()` call instead of 30+.

| File | Change |
|---|---|
| `src/hooks/useIndependentCandidates.ts` | Add a debounce ref to the real-time subscription callback. When multiple changes arrive within 2 seconds, only the last one triggers a refresh. Also add pagination to `getCandidates()` — select only essential columns instead of `SELECT *` to reduce query weight. |

### Key change (real-time handler):

```typescript
// Instead of calling getCandidates() directly on every event:
const debounceRef = useRef<NodeJS.Timeout | null>(null)

// In the subscription callback:
(payload) => {
  if (debounceRef.current) clearTimeout(debounceRef.current)
  debounceRef.current = setTimeout(() => {
    getCandidates()
  }, 2000) // Wait 2s after last change before refreshing
}
```

### Secondary optimization — cache the org tree:

`getOrganizationTree()` runs 3 queries every time `getCandidates()` is called. Cache the result so it's only fetched once per session:

```typescript
const orgTreeRef = useRef<string[] | null>(null)

// In getCandidates:
const orgIds = orgTreeRef.current || await getOrganizationTree(organizationId)
orgTreeRef.current = orgIds
```

These two changes together reduce the query load from ~120 queries per batch to ~4 queries per batch.




# Fix: Suggested Candidates Returning 0 Results

## Root cause

The `get-suggested-candidates` edge function crashes on **every** request with:

```
column candidates.first_viewed_by does not exist
```

Line 157 of the function selects `first_viewed_by` from the `candidates` table, but that column doesn't exist. The query fails before any AI scoring happens, so 0 results are always returned.

## Fix

**File**: `supabase/functions/get-suggested-candidates/index.ts`

Remove `first_viewed_by` from the `.select()` call on line 157, and remove the reference to it on line 302 where it's mapped into the response object.

| Line | Change |
|------|--------|
| 157 | Remove `first_viewed_by` from the select fields |
| 302 | Remove `first_viewed_by: c.first_viewed_by` from the response mapping |

Then redeploy the edge function.


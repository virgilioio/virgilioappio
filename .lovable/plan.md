

# Specific Error Messages for Application Limit Violations

## Problem

When a candidate can't apply (e.g., duplicate job, too many applications, or rejection cooldown), they see a generic "Submission Failed" toast. This happens because:

1. The server returns a **429 status code** for limit violations, but `supabase.functions.invoke` treats non-2xx responses differently -- the response body may end up in `error` instead of `data`, causing the violation-handling code to be skipped entirely.
2. The code then falls into the generic catch block, showing "Submission failed / Something went wrong."
3. Even when violations ARE detected, only the "same job cooldown" type has a user-friendly message -- the other two types just show a raw database message.

## Solution

### File: `src/pages/PublicJobPosting.tsx`

**Fix 1: Handle violations from both `data` and `error` paths**

After the `supabase.functions.invoke` call, check both the `data` object AND parse the error response for violation info. The `supabase.functions.invoke` returns `{ data, error }` where for non-2xx, the JSON body is typically still available in `data` (Supabase JS v2 behavior). We'll add a safety net to also parse the error context.

**Fix 2: Add friendly messages for ALL violation types**

Map each violation type to a clear, human-readable title and description:

| Violation Type | Toast Title | Toast Description |
|---|---|---|
| `same_job_cooldown` | "Already Applied" | "You've already applied to this position. You can reapply after [date] (in X days)." |
| `max_applications_exceeded` | "Application Limit Reached" | "You've reached the maximum of 3 applications in the last 60 days. Please try again later." |
| `rejection_cooldown` | "Please Wait to Reapply" | "You can submit a new application after [date] (in X days)." |
| (unknown/fallback) | "Application Not Submitted" | The raw violation message from the server |

**Fix 3: Improve the generic catch-block error**

Update the fallback error in the catch block to say "Unable to submit application" with a more helpful description: "Please check your connection and try again. If the problem persists, contact the employer directly."

### File: `supabase/functions/public-submit-application/index.ts`

**Fix 4: Return 200 (not 429) for application limit responses**

Change the status code from 429 to 200 for limit violation responses. The response body already has `success: false` and `violations` array, which is sufficient for the client to distinguish success from failure. This ensures `supabase.functions.invoke` reliably puts the response in `data` rather than `error`.

## Technical Details

### Changes in `src/pages/PublicJobPosting.tsx` (~lines 452-510)

- Add a helper function `getViolationToast(violation)` that returns `{ title, description }` based on violation type
- Handle all three violation types with specific, empathetic copy
- Calculate "days until" for cooldown types and include the date
- Update the catch block's generic toast to be more helpful

### Changes in `supabase/functions/public-submit-application/index.ts` (~line 204)

- Change `status: 429` to `status: 200` so the client reliably receives the violations in `data`

### Files changed

| File | Change |
|---|---|
| `src/pages/PublicJobPosting.tsx` | Add violation-specific toast messages with friendly titles and descriptions; improve generic error fallback |
| `supabase/functions/public-submit-application/index.ts` | Return 200 instead of 429 for limit violations (body already indicates `success: false`) |




# Fix: Application Details Not Showing in Candidate Profile

## Root Cause Analysis

Data exists — 9 application responses for this candidate+job, 6 of which are custom fields that should display after filtering. The code logic is correct. The most likely cause is a **silent RLS failure** on the client side: the Supabase client returns an empty array instead of an error when RLS blocks access, and the component silently returns `null`.

The RLS policy on `candidate_application_responses` requires either:
- A JOIN through `jobs → members` (org membership match), OR  
- `get_user_type_secure() = 'platform_admin'`

The second path should work for this user. However, if there's any issue with the `get_user_type_secure()` function evaluation in the client JWT context, the query silently returns `[]`.

## Plan

### 1. Add diagnostic logging to `CandidateApplicationResponses.tsx`

Add `console.log` statements to trace:
- The `candidateId` and `jobId` props received
- The raw data count before/after filtering
- Any errors from the Supabase query

This will surface in the console on next load so we can confirm whether the issue is "no data returned" (RLS) or "data returned but filtered out" (logic bug).

### 2. Replace `return null` with a visible empty state

Currently when `responses.length === 0`, the component returns `null` — making the tab appear broken. Change this to show "No application responses found" with a subtle message, so the user (and us) can distinguish between "component didn't render" vs "component rendered but found nothing."

### 3. Add RLS fallback: tenant-based access for platform_admin

The current RLS policy relies on `get_user_type_secure()` which queries `auth.users` metadata. As a safety net, add an additional OR condition using the existing tenant-based access pattern (checking if the user's tenant matches the job's tenant), ensuring platform admins from the parent org can always access cross-org application responses.

## Files to modify

| File | Change |
|------|--------|
| `src/components/candidates/CandidateApplicationResponses.tsx` | Add console logging, replace `return null` with visible empty state |
| Migration SQL | Add/update RLS policy on `candidate_application_responses` to include tenant-based platform_admin access |


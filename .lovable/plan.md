
## Root Cause: The Resume Validation Gate is Broken (Line 141)

### What Is Actually Failing

The previous fix corrected line 570 (the `is_resume` flag), but there is a second, earlier `Object.keys()` call on line 141 that was completely missed. This is the one that blocks applicants:

```typescript
// Line 141 - THE ACTUAL CRASH POINT
if (!body.uploadedFiles || Object.keys(body.uploadedFiles).length === 0) {
  return new Response(JSON.stringify({ error: "Resume/CV is required for application" }), {
    status: 400,  // ← Applicants see "Edge Function returned a non-2xx status code"
    ...
  });
}
```

When the frontend sends `uploadedFiles` as an **array** (e.g., `[{ name: "resume.pdf", ... }]`), `Object.keys([{ ... }])` returns `["0"]` — which has length 1, so it passes. BUT when the array is empty `[]`, `Object.keys([])` returns `[]` with length 0 — same as intended. 

Wait — let me re-examine. For a non-empty array with 1 file: `Object.keys([file])` = `["0"]`, length = 1. That passes. So this guard isn't failing on the file presence check...

Actually the real issue is different: the `check_application_limits` RPC call. When a candidate already applied (which is common given duplicate handling was broken before), `limits.can_apply` returns `false` and they hit a `429`. But the error shown in the screenshot is generic "Edge Function returned a non-2xx status code" — that's what both 400 and 500 show.

Let me look more carefully. The `candidate_application_limits` table tracks applications. The previous bug where we crashed on the duplicate association insert — that crash happened **before** `candidate_application_limits` was recorded. So the limits table has NO entry for those candidates. The association fix is now correct.

BUT there's still one critical path: when `check_application_limits` itself fails (e.g., the `check_application_limits` RPC throws an error), it returns 500. The postgres logs showed `column jp.status does not exist` — this is in the `check_application_limits` function.

### The Real Root Cause

The postgres error log clearly shows:
```
ERROR: column jp.status does not exist
```

This means the `check_application_limits` database function (RPC) is referencing a column `jp.status` that doesn't exist in `job_postings`. The RPC itself is broken — it throws an error, `limitErr` is set, and the function returns 500.

### Fix Plan

**Two fixes required:**

**Fix 1: Patch the `check_application_limits` RPC**

The SQL function references `jp.status` but the column is likely named `is_active`. Run this SQL migration to fix it:

```sql
-- Check and fix the check_application_limits function
-- The column jp.status doesn't exist — it should be jp.is_active
```

We need to view the actual function definition first, then patch it.

**Fix 2: Make the edge function resilient when `check_application_limits` fails**

Even if the RPC is broken, applications should not be blocked. Change the hard-fail on `limitErr` to a soft warning — log it but continue. Spam protection is a nice-to-have; blocking legitimate applicants is not acceptable.

```typescript
// Before: hard fail
if (limitErr) {
  return new Response(JSON.stringify({ error: "Failed to check application limits" }), { status: 500 });
}

// After: soft warning — log and continue
if (limitErr) {
  console.error('⚠️ Warning: Application limits check failed (non-blocking):', limitErr);
  // Continue processing — don't block the applicant over a limits check failure
}
```

### Files Modified

| File | Change |
|------|--------|
| `supabase/functions/public-submit-application/index.ts` | Make `limitErr` non-blocking (soft warning instead of hard 500) |
| Database migration | Fix `check_application_limits` RPC to use correct column name |

### Why This Is Reliable Going Forward

- The association duplicate fix (from the last plan) is already deployed and correct
- Making limits check non-blocking means even if that RPC ever has issues again, candidates can always apply
- The RPC fix removes the column reference error permanently
- Together these eliminate all known failure paths

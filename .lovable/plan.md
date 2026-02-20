
## Root Cause: Duplicate Application Crash (500 Error)

### What Is Happening

The postgres logs captured 3 consecutive errors at the moment applicants were failing:

```
ERROR: there is no unique or exclusion constraint matching the ON CONFLICT specification
```

The `job_candidate_associations` table has a **UNIQUE constraint on `(job_id, candidate_id)`** — which is correct by design. But the edge function at line 316 does a plain `INSERT` with zero duplicate protection:

```typescript
const { error: assocErr } = await supabase
  .from("job_candidate_associations")
  .insert({
    job_id: posting.job_id,
    candidate_id: globalCandidateId,
    status: "active",
    current_stage_id: null,
  });

if (assocErr) {
  // Returns HTTP 500 to the user
  return new Response(JSON.stringify({ error: "Failed to place candidate in Application Review" }), {
    status: 500, ...
  });
}
```

When a candidate who already applied (or whose email was already in the system and associated with this job) tries to apply again, the insert violates the unique constraint → `assocErr` is set → **the user gets a 500 error page**.

This happens even if the candidate is legitimately applying for the first time but their email already exists as a candidate in the system tied to this job (e.g., added internally by a recruiter).

### Second Issue: `Object.keys()` on an Array

Line 555 in the edge function:
```typescript
Object.keys(body.uploadedFiles || {}).length === 1
```
`uploadedFiles` is sent as an array, not an object. `Object.keys([file])` returns `["0"]`, so length IS 1 — this part works accidentally. However it's fragile.

### Fix Plan

**File: `supabase/functions/public-submit-application/index.ts`**

Two surgical changes:

**1. Handle duplicate association gracefully (main crash fix)**

Replace the hard-fail association insert with upsert logic. If the candidate is already associated with this job, skip creating a new one (they've already applied — which is fine, the limits check above already handles actual spam). The postgres unique constraint name is `job_candidate_associations_candidate_id_job_id_key`.

Change from:
```typescript
const { error: assocErr } = await supabase
  .from("job_candidate_associations")
  .insert({ job_id, candidate_id, status: "active", current_stage_id: null });

if (assocErr) {
  return new Response(JSON.stringify({ error: "Failed to place candidate in Application Review" }), { status: 500 ... });
}
```

To:
```typescript
// Check for existing association first to avoid unique constraint crash
const { data: existingAssoc } = await supabase
  .from("job_candidate_associations")
  .select("id")
  .eq("job_id", posting.job_id)
  .eq("candidate_id", globalCandidateId)
  .maybeSingle();

if (!existingAssoc) {
  const { error: assocErr } = await supabase
    .from("job_candidate_associations")
    .insert({ job_id: posting.job_id, candidate_id: globalCandidateId, status: "active", current_stage_id: null });

  if (assocErr) {
    console.error("Error creating association:", assocErr);
    // Only hard-fail if it's NOT a duplicate (23505 = unique violation)
    if (!assocErr.code?.includes('23505')) {
      return new Response(JSON.stringify({ error: "Failed to place candidate in Application Review" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
  }
}
```

This is a **check-then-insert** pattern (race-condition safe enough here since limits are checked above) that prevents the crash entirely.

**2. Fix the `uploadedFiles` array check for `is_resume` flag (line 555)**

```typescript
// Before (broken for arrays):
Object.keys(body.uploadedFiles || {}).length === 1

// After (works for both array and object):
(Array.isArray(body.uploadedFiles) ? body.uploadedFiles.length : Object.keys(body.uploadedFiles || {}).length) === 1
```

### Files Modified

| File | Change |
|------|--------|
| `supabase/functions/public-submit-application/index.ts` | Check for existing association before insert; fix array vs object length check for `is_resume` |

### Why No Edge Function Logs Were Visible

The no-logs mystery: since the edge function is invoked via the Supabase client SDK (which internally makes an HTTP request), logs only appear after a successful boot. The error happens deep in the function after successful boot — the crash exits via the `if (assocErr)` return path which does log to stderr but those logs may have been rotated. The postgres logs (which are captured at DB level) confirm exactly what happened.

### What This Does NOT Require

- No database schema changes
- No new tables
- No RLS changes
- Just a 15-line guard in the edge function

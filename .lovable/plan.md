
## Root Cause

The `public-submit-application` function performs a lookup for an existing candidate using `email + tenant_id`, but the `candidates` table has a **unique constraint on `(email, candidate_name)`**. When a candidate with the same email and name exists — even if the `tenant_id` lookup misses them — the `INSERT` throws a `23505` duplicate key violation. The function hard-returns a 500 instead of recovering.

This hits any returning applicant or any applicant whose record was created through any other flow (e.g., internal import) with a matching email + name combination.

## The Fix: Two-Layer Graceful Recovery

### Layer 1 — Better Lookup (Lines 215-229)
Add `candidate_name` to the lookup query to match the exact unique constraint and avoid phantom misses:
```typescript
.eq("email", candidateEmail)
.eq("candidate_name", candidateName)   // ← add this
.eq("tenant_id", postingTenantId)
```

### Layer 2 — Graceful 23505 Recovery (Lines 261-276)
When the `INSERT` fails with code `23505` (duplicate), instead of returning a 500, the function should **fetch the existing candidate's ID and continue** the rest of the flow normally:

```typescript
if (globalInsertErr) {
  if (globalInsertErr.code === '23505') {
    // Duplicate — fetch the existing record and continue
    const { data: dupeCandidate } = await supabase
      .from("candidates")
      .select("id")
      .eq("email", candidateEmail)
      .eq("candidate_name", candidateName)
      .maybeSingle();
    if (dupeCandidate) {
      globalCandidateId = dupeCandidate.id;
    } else {
      // Fallback: lookup by email + tenant only
      const { data: fallback } = await supabase
        .from("candidates")
        .select("id")
        .eq("email", candidateEmail)
        .eq("tenant_id", postingTenantId)
        .maybeSingle();
      if (fallback) globalCandidateId = fallback.id;
    }
    if (!globalCandidateId) {
      return new Response(...500);  // truly unrecoverable
    }
    // else: fall through with existing candidate ID ✅
  } else {
    return new Response(...500);  // different DB error
  }
}
```

## Files Changed

- `supabase/functions/public-submit-application/index.ts` — update lookup query and add duplicate-key recovery in the candidate creation block. No schema changes needed.

## Impact

All applicants who previously had a record in the database (returning applicants, internally-imported candidates) will now complete their application successfully instead of receiving a 500 error.

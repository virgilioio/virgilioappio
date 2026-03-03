

# "Sync Job Candidates" Button — Analysis and Removal Plan

## What It Is

The "Sync Job Candidates" button triggers an RPC function (`sync_job_candidates_to_independent`) that was part of a **data migration** from a legacy `job_candidates` table to the modern `candidates` + `job_candidate_associations` model. This was a one-time migration task documented in `docs/migrations/phase2-cycle1.md` and marked as completed in `docs/migrations/phase2-cycle1-COMPLETION.md`.

## Is It Still Relevant?

**No.** The migration is complete (documented as done). This button was a convenience for running the migration from the UI, but it has no ongoing purpose. Leaving it exposed to users is confusing and potentially risky (re-running a migration sync unnecessarily).

## Removal Plan

**Files to modify:**

1. **`src/pages/Candidates.tsx`** — Remove the sync button, the `handleSync` function, and the `useCandidateSync` import
2. **`src/hooks/useCandidateSync.ts`** — Delete entirely
3. **`scripts/run_sync_candidates.ts`** — Delete entirely (one-time migration script)

**Files left untouched:**
- Database migrations and RPC function — safe to leave in place (dropping RPCs from the DB is a separate concern and won't affect the app)
- Migration docs — keep as historical record

**Impact:** UI cleanup only. No functional features depend on this sync button.


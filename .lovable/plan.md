

# Fix: Invalid UUID Error When Creating Offer Letters

## Problem

When saving an offer, `candidate.job_id || ''` passes an empty string `""` as `job_id`. The `offer_letters.job_id` column is a non-nullable UUID, so Postgres rejects `""` with `"invalid input syntax for type uuid"`.

## Root Cause

Both `CandidateProfileSheet.tsx` (line 1841) and `CandidateProfile.tsx` (line 619) pass `jobId={candidate.job_id || ''}`. When `candidate.job_id` is null, the empty string reaches the database insert.

## Fix

Since candidates in the offer flow should always have a `job_id` (they're associated with a job), the fix is defensive:

1. **`OfferComposerBody.tsx`** — Add a guard in `handleSave` to reject empty/missing `jobId` before calling `createOfferLetter`:
   ```tsx
   if (!jobId) {
     toast({ title: 'Error', description: 'Job association is required to create an offer.', variant: 'destructive' })
     return
   }
   ```
   Also update `canSave()` to check `!!jobId`.

2. **`CandidateProfileSheet.tsx`** and **`CandidateProfile.tsx`** — No change needed since the guard in the composer handles it. The `|| ''` fallback is fine for the prop type, the validation just needs to happen before the DB call.

## Files changed
- `src/components/candidates/OfferComposerBody.tsx` — Add `jobId` validation in `canSave()` and `handleSave()`


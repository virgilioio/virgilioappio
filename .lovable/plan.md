## Problem

Clicking **Merge** in the Duplicate Candidate Detected modal fails with a Postgres error mentioning a company column (user described as "previous company"). The real column referenced by the error is `current_company` on `public.candidates` — that column does not exist. The `candidates` table only has `company_current`.

### Root cause

`mergeCandidate` in `src/lib/candidateHelpers.ts` builds its `UPDATE` payload by:

1. `smartMerge(existingCandidate, incoming)` — starts from the DB row (valid columns) but then copies every key from the incoming form payload onto the merged object.
2. Destructures out just `id`, `created_at`, `created_by`, `assignedJobId`, `assignedStageId`, `job_id`, `notes`, then spreads the rest into `supabase.from('candidates').update(...)`.

The form payload from `CandidateFormSheet` includes fields that are **not** columns on `candidates`:
- `current_company` (form field; the real column is `company_current`)
- `salary_amount_max`
- `first_name`, `last_name` (form-only; DB stores `candidate_name`)

Postgres rejects the update with `column "current_company" of relation "candidates" does not exist`, which surfaces to the user as a merge error mentioning a company field. Create still works because `createCandidate` cherry-picks known columns; only merge does a raw spread.

Note: no error appears for the transfer/add flow — this is scoped strictly to merge.

## Fix (single file, presentation-adjacent, no behavior change to the merge dialog itself)

Edit **`src/lib/candidateHelpers.ts` → `mergeCandidate`** so the `UPDATE` payload is built from an explicit allowlist of real `candidates` columns instead of spreading `mergedData` wholesale.

Steps:

1. After `smartMerge`, construct `updateFields` by picking only these keys from `mergedData` (mirrors the columns `createCandidate` already writes, plus the enriched columns we want to preserve on merge):
   - `candidate_name`, `email`, `phone`
   - `contact_emails`, `contact_phones`
   - `location_country`, `location_state`, `location_city`
   - `salary_amount`, `salary_currency`, `salary_period`
   - `profile_summary`, `linkedin_url`, `resume_url`
   - `skills`, `status`, `source`
2. Drop any keys whose value is `undefined` so smart-merged nulls from the existing row aren't wiped out unnecessarily.
3. Leave everything else in the file untouched: `smartMerge`, `checkForDuplicateCandidate`, `createCandidate`, `createJobAssociation`, and the merge dialog UI stay exactly as they are. The duplicate-detection trigger, field comparison, and confirm/cancel handlers in `CandidateFormSheet` and `CandidateMergeDialog` are not modified.

### Why the allowlist and not a column rename

The form intentionally captures `current_company` and `salary_amount_max` for other UX (profile display, sourcing preview) but neither has a corresponding column on `public.candidates`. Renaming form fields would be a wider refactor; the merge bug is purely that we were pushing form-only fields into a DB update. Filtering at the merge boundary matches the existing pattern in `useCandidates.updateCandidate` (which already uses an allowlist) and keeps the change minimal.

## Verification

- Trigger the duplicate flow: add a candidate whose email matches an existing one, click Merge in the modal.
- Expected: toast "Candidate merged and added to job", association created, no Postgres error in console/network.
- Regression check: normal add (non-duplicate) still succeeds; cancel from the merge dialog still just closes it.

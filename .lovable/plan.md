

# Add "Hired" Status Banner to Candidate Profile Sheet

## Problem

When a candidate is marked as "hired", there's no visual banner like the ones for "rejected" and "offer" statuses. The user wants a hired banner showing: job name, hire date, candidate source, and the recruiter who hired them.

## Database Change

The `job_candidate_associations` table currently has no `hired_at` or `hired_by` columns (unlike `rejected_at`/`rejected_by` and `offered_at`/`offered_by`). We need to add them.

**Migration:**
```sql
ALTER TABLE public.job_candidate_associations
  ADD COLUMN hired_at timestamptz,
  ADD COLUMN hired_by uuid REFERENCES auth.users(id);
```

## Code Changes

| File | Change |
|------|--------|
| `src/components/candidates/HiredStatusBanner.tsx` | **New file** — banner component matching rejection/offer banner pattern |
| `src/components/candidates/CandidateProfileSheet.tsx` | (1) Add `hired_at`, `hired_by` to the association `.select()` query. (2) Add `hiredDetails` state. (3) Populate it when `status === 'hired'` (resolve recruiter name from profiles, get job title from existing `job` state, get source from `candidate.source`). (4) Set `hired_at`/`hired_by` when marking as hired via `handleSetStatus`. (5) Render `HiredStatusBanner` alongside the rejection/offer banners. |

## HiredStatusBanner Component

- Emerald/green background (`bg-emerald-700`) to match the "hired" semantic color
- Shows:
  - **Title**: "Candidate Hired"
  - **Job name**: from the loaded job data
  - **Hire date**: formatted from `hired_at`
  - **Source**: from `candidate.source` or `candidate.job_board_source`
  - **Recruiter**: resolved name from `hired_by` profile lookup
- No action button needed (unlike rejection's "Reactivate" or offer's "Create Offer")

## handleSetStatus Update

When `handleSetStatus('hired')` is called, update the association with `hired_at: new Date().toISOString()` and `hired_by: user?.id` alongside the status change (similar to how `handleMoveToOffer` sets `offered_at`/`offered_by`).

## Visual Result

```text
┌─────────────────────────────────────────────────────┐
│  ✓ Candidate Hired                                  │
│  Account Executive, Enterprise • Mar 27, 2026       │
│  Source: LinkedIn • Recruiter: Allan Bravo           │
└─────────────────────────────────────────────────────┘
```


# Show who created a candidate

## What's happening today

The database already records the creator: `candidates.created_by` is populated on 2,273 of 2,391 live candidate records (all app, CSV, Chrome-extension and sourcing creation paths write it; only inbound job-board applications leave it null by design).

The value is simply never fetched or rendered:

- The independent profile's **Record details** card reads `candidate.added_by_name`, a field that no query ever returns — so "Added by" is always blank.
- The in-job profile's **Application** card only renders Applied / Source / Comp ask / Open to / Work auth — there is no creator row at all.

So this is a display/plumbing gap, not a data capture gap.

## What we'll build

1. **Resolve creator names.** A small shared hook that takes user IDs and returns display names from `profiles` (first + last name, falling back to email). Cached, so opening several profiles doesn't refetch.

2. **In-job candidate profile → Job overview → Application card.** Add a "Created by" row (person icon) after "Applied". Value = the candidate's creator; when that's missing (e.g. a candidate that arrived through a job board), fall back to who added the candidate to this job, and otherwise show "—".

3. **Independent candidate profile → Details → Record details card.** Point the existing "Added by" row at the real resolved creator name instead of the phantom `added_by_name` field.

Nothing else changes: no schema migration, no new permissions, no changes to how candidates are created.

## Technical notes

- `src/hooks/useCandidates.ts`: add `created_by` to the `candidates!inner (...)` select and map it onto the returned candidate (the `Candidate` type gets a `created_by` field). The independent list hook (`useIndependentCandidates.ts`) already selects `created_by`.
- New `src/hooks/useUserDisplayNames.ts`: `useQuery` over `profiles` filtered by `user_id in (...)`, returning `Record<string, string>`; keyed on the sorted id list with a long `staleTime`.
- `src/components/candidates/profile/ProfileApplicationCard.tsx`: new optional `createdByName?: string | null` prop plus one extra row; the parent (`CandidateProfileSheet`) resolves the name via the hook using `candidate.created_by ?? association.added_by`.
- `src/pages/IndependentCandidateProfile.tsx`: replace `(candidate as any).added_by_name` with the resolved name for `candidate.created_by`.

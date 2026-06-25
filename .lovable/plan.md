## Plan

1. **Fix the real blocker in RLS**
   - The anonymous public posting query is failing with `infinite recursion detected in policy for relation "jobs"`.
   - I’ll update the public RLS policy setup so anonymous reads use only simple public policies:
     - `job_postings`: anon can read active, non-deleted postings.
     - `jobs`: anon can read only open, non-deleted jobs that have an active posting.
   - I’ll move the org-member/internal `job_postings` read policies that reference `jobs` to `authenticated` only, so they no longer run for anonymous visitors and trigger recursion.

2. **Preserve sensitive data protection**
   - Keep anon access to `jobs` limited to the minimum columns needed by the public route, currently `id` and `status`.
   - Keep public posting fields limited to data already intended for public job pages.

3. **Verify the exact failing path**
   - Re-test the anonymous REST query for `/careers/:companySlug/:postingSlug` using the anon key.
   - Confirm it returns the posting instead of the recursion error / empty result.

4. **Adjust frontend only if still needed**
   - If the DB fix resolves the query, no frontend change is needed.
   - If the public careers listing or legacy `/p/:slug` path still hits a recursive join, I’ll update those fetches to use the corrected public-safe path consistently.

## Technical notes

- Current routes are already outside `RequireAuth`, so this is not an auth-gate issue.
- The “Posting not found” screen is caused by the frontend swallowing the failed anonymous Supabase query and receiving no posting data.
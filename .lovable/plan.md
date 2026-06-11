# Real Apollo candidates in onboarding (step 4)

Today step 4 calls `get-job-matching-candidates` (DB-only matching) and the right-side preview shows three hardcoded `SAMPLE_CANDIDATES`. We'll spend ~3 Apollo previews to show real, real-named candidates for the job the user just created.

## Cost shape (so the trade-off is explicit)

- **Apollo search (preview)** is the cheap call — returns obfuscated last names + title + company + has-email/has-phone flags. No enrichment, no LinkedIn URLs, no contact data. This is what we'll use.
- **PDL** and **Apollo enrichment** stay disabled for onboarding (those are the expensive parts per the PDL cost memory).
- Hard cap: **3 candidates**, single Apollo call, no pagination, no retry.

That's ~1 Apollo search credit total per onboarded workspace, not 3 enrichment credits. If the user genuinely wants 3 enrichments instead, say the word and I'll switch — the cost goes ~5–10x.

## Flow change (step 3 → step 4)

Right after `createJob` returns in step 3, kick off a new edge function `seed-onboarding-candidates` (server-side, service-role) that does the whole sequence atomically:

1. Insert a `sourcing_projects` row tied to `job_id` with minimal `search_criteria`:
   - `title_keywords: [jobTitle]`
   - `locations: jobLocation ? [jobLocation] : []`
   - `skills: []`
2. Invoke `search-apollo-candidates` with `{ project_id, criteria, limit: 3, max_results: 3 }`.
3. Return a compact array of 3 candidates shaped for the preview:
   ```ts
   { name, role, company, initials, color, match }
   ```
   - `name`: `first_name + " " + last_name_obfuscated` (e.g. "Teresa G***n")
   - `role`: `title || 'Candidate'`
   - `company`: `organization?.name || ''`
   - `match`: deterministic 88/91/94 from index (Apollo preview has no score; we don't fabricate one — we label these as "Top match" tiers in the UI, not exact %)
   - `color`: pick from the existing 3-color palette by index

Why server-side: keeps `APOLLO_API_KEY` server-only, lets us use service-role for the sourcing-project insert without dragging RLS into onboarding, and bounds the credit cost in one place.

## Client changes (`OnboardingFlow.tsx`)

- Replace the step-4 `useEffect` that calls `get-job-matching-candidates` with a call to the new `seed-onboarding-candidates` function.
- Keep the 1.6s minimum-delay UX (so the "Scanning…" animation feels real even when Apollo answers in 400ms).
- Store the returned candidates in component state and pass them into `preview` instead of the hardcoded `SAMPLE_CANDIDATES`.
- If Apollo fails or returns 0: **fall back to the existing `SAMPLE_CANDIDATES`** and silently log — onboarding never blocks on a 3rd-party outage.
- Demo route (`/__preview/onboarding`): skip the call entirely, keep showing `SAMPLE_CANDIDATES` (already gated by the `demo` prop).

## Copy update

The lilac proof box on step 4 currently says "These are real, sourceable people". That's only true when Apollo succeeded. Change it to render conditionally:
- Apollo success → keep current copy.
- Fallback → "Here's a feel for what your queue looks like — your real matches arrive in Find."

## Backend: new edge function `seed-onboarding-candidates`

- Input: `{ job_id: string, organization_id: string, job_title: string, location?: string }`.
- Auth: JWT required, validates the caller belongs to `organization_id`.
- Steps: create sourcing project → invoke `search-apollo-candidates` (3-cap) → map preview shape → return.
- Errors return `{ candidates: [] }` with 200 so the client falls back cleanly.

No DB schema changes. No new secrets (`APOLLO_API_KEY` already exists per `search-apollo-candidates`).

## What we explicitly will NOT do here

- No enrichment (no real emails/phones revealed in onboarding).
- No PDL call.
- No write into the candidate pipeline yet (the 3 results live on the sourcing project; promoting them into Pipeline can be a follow-up).
- No change to the existing `get-job-matching-candidates` (other callers untouched).

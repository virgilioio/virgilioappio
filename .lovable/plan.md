

# Display Resume URL in the URLs Card

## What
When a candidate has a `resume_url` (typically from CSV imports), automatically display it as a read-only entry in the CandidateUrls card — alongside any manually added URLs. This works for both independent and job-associated candidate profiles.

## How

**File: `src/hooks/useCandidateUrls.ts`**
- After fetching URLs from `candidate_urls` table, also fetch the candidate's `resume_url` from the `candidates` table
- If `resume_url` exists and is an external URL (starts with `http`), prepend a synthetic URL entry to the list with label "Resume / CV", icon `link`, and a special `isResumeUrl: true` flag so it can't be deleted via the normal flow

**File: `src/components/candidates/CandidateUrls.tsx`**
- Render the synthetic resume URL entry identically to other URLs but mark it as non-deletable (no trash icon) since it's sourced from the candidate record, not the `candidate_urls` table
- Add a `FileText` icon option for the resume entry to visually distinguish it

This is a display-only change — no database schema modifications needed. The `resume_url` field already exists on the `candidates` table.


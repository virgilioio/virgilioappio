## Goal

Make the **Demographic survey (EEO)** toggle on job postings actually functional, US EEOC-compliant, and privacy-safe. When ON, applicants see a standard, optional EEO section at the end of the public application; responses are stored **separately from the candidate identity**, **invisible to recruiters/hiring managers individually**, and surfaced only as **aggregate analytics**.

## Compliance baseline (US EEOC standard)

Four optional questions, each with a "Decline to self-identify" choice:

1. **Gender** — Male / Female / Non-binary / Decline
2. **Race & Ethnicity** (EEO-1 categories) — Hispanic or Latino / White / Black or African American / Asian / Native Hawaiian or Other Pacific Islander / American Indian or Alaska Native / Two or More Races / Decline
3. **Veteran status** (VEVRAA) — Protected Veteran / Not a Protected Veteran / Decline
4. **Disability status** (Section 503, OFCCP voluntary self-ID form) — Yes, I have a disability / No / Decline

Plus the standard legal disclaimer: voluntary, will not affect hiring, used only for EEO reporting, kept separate from the application.

## Architecture

```text
┌─────────────────────┐   submit    ┌──────────────────────────┐
│ PublicJobPosting    │ ──────────► │ public-submit-application│
│  (apply form)       │             │  edge function           │
└─────────────────────┘             └─────────┬────────────────┘
                                              │ writes 2 rows
                                  ┌───────────┴────────────┐
                                  ▼                        ▼
                       candidates + responses     eeo_responses
                       (recruiters see this)     (NO candidate_id,
                                                  NO PII, posting_id
                                                  + submission_token
                                                  only)
```

Key privacy rule: `eeo_responses` rows are **not joinable back to a candidate**. They store `job_posting_id`, `tenant_id`, anonymized `submission_token`, the 4 answers, and a timestamp. No FK to candidates, no IP, no email.

## Changes

### 1. Database (migration)

- New table `public.eeo_responses`:
  - `id`, `tenant_id`, `job_posting_id`, `job_id` (denormalized for reporting), `submission_token` (uuid, random per submission, **not** linked to candidate), `gender`, `race_ethnicity`, `veteran_status`, `disability_status`, `submitted_at`.
  - All answer columns nullable + use Postgres enums (`eeo_gender`, `eeo_race_ethnicity`, `eeo_veteran_status`, `eeo_disability_status`) including a `declined` value.
- GRANTs: `anon` INSERT only (public submissions), `authenticated` no direct access, `service_role` ALL.
- RLS:
  - `INSERT` allowed for `anon` and `authenticated` (anyone applying).
  - `SELECT` **denied to everyone** at row level — even tenant members cannot read individual rows.
  - Aggregate access exposed only through a `SECURITY DEFINER` function `get_eeo_aggregate(p_job_posting_id uuid)` that:
    - Verifies caller belongs to the posting's tenant AND has admin/workspace-owner role (no hiring-manager / interviewer / sales).
    - Returns **counts only**, and suppresses any bucket with `< 5 responses` (k-anonymity) to prevent re-identification.
- No change to `job_postings` schema — the existing `details.eeo_enabled` boolean stays as the toggle source of truth.

### 2. Public application form — `src/pages/PublicJobPosting.tsx`

- Read `details.eeo_enabled` from the posting.
- If true, render a new `<EeoSurveySection>` after the application fields and before submit:
  - Clear heading "Voluntary self-identification"
  - Full EEOC disclaimer text (voluntary, confidential, kept separate, will not be used in hiring decisions)
  - 4 radio groups, all defaulting to unselected, each with "Decline to self-identify"
  - Visually de-emphasized (muted card) so it reads as separate from the application
- Include EEO answers in the submit payload under a dedicated `eeo` key (never mixed into `application_responses`).

### 3. Submission edge function — `supabase/functions/public-submit-application/index.ts`

- After creating the candidate + application responses, if payload has `eeo` and posting has `eeo_enabled`:
  - Generate a fresh `submission_token` (uuid).
  - Insert one row into `eeo_responses` with `tenant_id`, `job_posting_id`, `job_id`, the 4 fields, and the token.
  - **Do not** store the token on the candidate record — the link is intentionally severed.
- Failure to write EEO must not fail the application (best-effort, logged).

### 4. Recruiter UI — explicit non-exposure

- Add nothing to the candidate profile / application responses view about EEO.
- Update `CandidateApplicationResponses.tsx` to **filter out** any EEO keys defensively (belt-and-suspenders in case anything leaks).
- In `PostingSheet`, add a small inline note under the toggle: "Responses are anonymous, stored separately from candidates, and only visible as aggregate reports to workspace owners."

### 5. Analytics — new EEO aggregate widget

- New hook `useEeoAggregateMetrics(jobPostingIds[])` calling `get_eeo_aggregate` per posting and merging counts client-side.
- New widget type `eeo_distribution` (4 stacked bar charts: gender, race, veteran, disability), registered in the analytics widget engine.
- Permission-gated: only `workspace_owner` and `platform_admin` can add/see this widget (`PermissionGate`).
- "< 5 responses" buckets render as "Suppressed for privacy".

### 6. Tests / verification

- DB test: anon can INSERT into `eeo_responses` but cannot SELECT.
- DB test: hiring manager calling `get_eeo_aggregate` is rejected.
- DB test: workspace owner gets counts; buckets under 5 are returned as 0/suppressed.
- Manual: toggle ON in PostingSheet → apply via public link → confirm row in `eeo_responses`, no link to candidate, no EEO data visible anywhere in the candidate profile, aggregate widget shows counts only.

## Out of scope (call out to user)

- EEO-1 employer report export (CSV in the exact federal format) — can be a follow-up once data starts accumulating.
- Non-US compliance variants (UK, Canada, EU diversity monitoring forms) — same architecture but different question sets; we'll add per-country presets only if requested.
- Storing EEO for candidates added manually / via sourcing (only public applications collect it, which matches industry standard).

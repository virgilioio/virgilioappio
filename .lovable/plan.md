# Link sourcing project to a job — 4-step flow

The yellow "Not linked to a job" banner already exists (Step 1). We rebuild the dialog it opens into the multi-step flow shown in the screenshots, and add the post-link confirmation (Step 4).

## What changes

### Step 1 — Trigger (no change)
Existing `LinkToJobBanner` already shows the yellow strip and `Link to job` primary button. Reuse as-is.

### Step 2 — Pick the job
Rewrite `src/components/sourcing/LinkToJobDialog.tsx`:

- Header: link icon + "Link this project to a job", subtitle "Future collects will route into the chosen pipeline stage."
- Search input (only "Search jobs…", no `kbd esc` hint — out of scope).
- **GIO THINKS THESE MATCH** group with up to 3 jobs scored against the project's `job_spec_data`. Each row shows: org icon · job title · `Design · NY · Remote OK` meta · `142 applicants` · `92% match` purple chip · `Hot` orange chip if score ≥ 85.
- **OTHER OPEN JOBS** group with the remaining open jobs (department, location, applicant count, recruiter avatar).
- Footer left: `Can't find it?` / right: `+ Create new job` ghost link (opens existing JobWizard — wiring deferred unless trivial; for now it triggers a toast "Create job from dialog coming soon" so we don't expand scope).
- Selecting a row advances to Step 3 immediately (no separate Confirm).

### Step 3 — Stage + backfill
New nested view inside the same dialog (no second modal):

- Compact job header: dark avatar square · title · `Design · 142 applicants · Maya Reyes` meta · back chevron.
- **DEFAULT STAGE FOR NEW COLLECTS** — radio list pulled from `useJobHiringPlan(jobId).loadHiringPlanInstances`. First stage gets a `Recommended` lilac chip. Stage row = small color square + name.
- **BACKFILL** section with two checkboxes:
  1. `Drop N already-collected candidates into <Stage>` (N = count of rows in `sourcing_preview_candidates` already collected for this project; defaults checked).
  2. `Send <Org> careers page link to all future collects` (default unchecked, only visible if the org has a published careers page — we'll just always show it; toggle stored on the project link op).
- Footer: left caption `N will move on link` · right: `Back` + `Link project` primary button.

### Step 4 — Linked + flowing
After successful link, banner location swaps: `LinkToJobBanner` (yellow) is replaced by a new `LinkedToJobBanner` (green) showing:

- Link icon · `Linked to <Job Title>` headline · `N collected candidates moved into <Stage> · future collects flow there automatically.`
- Pipeline preview chips: `SOURCED 24 +2` (lilac), `APPLIED 86`, `PHONE 14`, `ONSITE 4`.
- Actions: `Open pipeline` (primary, navigates to `/jobs/:id`), `Back to Find` (ghost), `Done` (ghost, dismisses banner for the session).

Banner auto-dismisses after the user clicks Done or navigates away. Persists across reloads as long as `project.job_id` is set and the user hasn't dismissed (session storage key `linked-banner-dismissed:<projectId>`).

## Files

- **Edit** `src/components/sourcing/LinkToJobDialog.tsx` — full rewrite for 2-step content + Gio match section.
- **New** `src/components/sourcing/LinkedToJobBanner.tsx` — green confirmation banner.
- **Edit** `src/components/sourcing/CandidatesTab.tsx` — render `LinkedToJobBanner` when `project.job_id` is set and not yet dismissed; keep yellow banner when unset.
- **Edit** `src/components/sourcing/LinkToJobBanner.tsx` — extend `onLinkToJob` signature so the dialog can pass `{ jobId, stageJhsId, backfill, careersLink }`. Keep the callback backward-compatible by ignoring extras at call sites that don't need them (the existing wiring in `useJobSourcingProject` / parent only persists `job_id`; we will add a follow-up edge function call for backfill).

## Data + plumbing

- **Match scoring**: client-side score against `sourcing_projects.job_spec_data` (title overlap, skills intersection, location). Tunable threshold (`>=70` → "match", `>=85` → `Hot`). No new backend.
- **Already-collected count**: `select count from sourcing_preview_candidates where project_id = :id and candidate_id is not null`.
- **Backfill action**: when `Link project` is clicked with backfill checked, after persisting `job_id` we call existing `usePipelineActions.addCandidateToJob` (or equivalent) for each already-collected `candidate_id`, placing them in the selected `jhsId`. If a candidate is already on the job, skip silently.
- **Careers-page toggle**: store as `sourcing_projects.send_careers_link` (boolean). Migration adds the column with default false. (Functional plumbing — sending the link on collect — is out of scope; the toggle is recorded only.)

## Out of scope

- "Create new job" inline (button is visible but shows a toast; opening JobWizard from inside this dialog is a follow-up).
- Actually emailing the careers page link on future collects.
- Reworking `SourcingProjectHeader` / `SourcingProjectActions` (those duplicates of `LinkToJobDialog` still call `onConfirm(jobId)` — they will continue to work because the new dialog still emits a `jobId` plus optional extras).
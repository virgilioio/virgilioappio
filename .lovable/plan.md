# Step 5 — Review & create

Rebuild `SummaryStep.tsx` to match the two reference screenshots. The same component renders both scenarios; the only branching is driven by whether the posting step was filled or skipped.

## Scenario detection

A posting is considered **filled** if Step 4 produced a posting (any of: posting title set, description set, ≥1 channel selected, custom application fields edited). Otherwise → **skipped / internal-only**.

Wire it via a new boolean `hasPosting` derived in `JobWizard.tsx` from `postingMeta` + posting state already tracked by `JobPostingStep`, and pass it into `SummaryStep`. No new backend state.

## Layout

Header (already in wizard chrome) — eyebrow `CREATE JOB · STEP 5 OF 5`, title `Review & create.`, subtitle:
- filled → "One last look before this job goes live. You can edit anything below by clicking Edit, or after creation in Job Setup."
- skipped → "One last look before this job is created. The public posting step was skipped — this job will be internal-only until you set it up."

Body (single column inside the existing main scroll area):

1. **Hero card** — `#0d0d09` bg, cream text, rounded-2xl, briefcase icon tile on the left.
   - Top row: Department badge (purple) · `L{level} Specialist · {employment_type} · {work_mode}` separated by `·`
   - Title: job title, big Poppins, with purple `.`
   - Status pill (top right):
     - filled → green dot · `Ready`
     - skipped → amber dot · `Internal`
   - Meta line: `$ {min–max} {currency}` · `↗ {years}` · `👥 {N} hiring team members` · `⌥ {N} pipeline stages`

2. **JOB INFORMATION** section — caps eyebrow + right-aligned `✎ Edit step 1` (jumps to step 1). White card with 2-col grid:
   Title, Internal title, Department, Level, Work mode, Locations, Type, Salary. Each row = small icon · label (muted) · value (right).
   Then `DESCRIPTION PREVIEW` sub-eyebrow + bordered quote-style box with first ~3 lines of description (line-clamp-3).
   Then `REQUIRED SKILLS · {N}` sub-eyebrow + skill chips (reuse existing skill chip styling/colors).

3. **HIRING PLAN · {N} STAGES** section — eyebrow + `✎ Edit step 2`. List of stage rows: numbered avatar, stage name, `Required` / `AI` / SLA badges on the right. Reuse data already in `wizardState`/`useJobStages` for `createdJobId`.

4. **HIRING TEAM · {N} MEMBERS** section — eyebrow + `✎ Edit step 3`. Compact list: avatar + name + job role badge.

5. **JOB POSTING** section — eyebrow + `✎ Edit step 4`.
   - filled → summary: channels list (Careers page + boards), application form field count, language, slug preview.
   - skipped → muted empty state card: "No public posting configured. You can publish later from Job Setup → Job postings." with a `Set up now` ghost button that jumps to step 4.

Sticky footer (replace existing Summary footer in `JobWizard.tsx` for step 5 only):
- Left: `← Back`, then `Status on create:` label + status pill
  - filled → green `Open · accepting applications`
  - skipped → amber `Internal only · not publicly listed`
- Right:
  - filled → `👁 Preview posting` (secondary) + `✓ Create & publish` (primary)
  - skipped → `Set up posting` (secondary, jumps to step 4) + `✓ Create job (internal)` (primary)

`Save and exit` stays available on step 5 as on other steps.

## Edit-step navigation

Each `Edit step N` link calls a new `goToStep(n)` setter exposed via prop from `JobWizard`. Existing left-rail click handler already supports arbitrary step jumps for accessible steps — reuse the same setter.

## Data sources

All values read from `wizardState.jobData` already populated by steps 1–4, plus:
- `useJobStages(createdJobId)` for hiring plan rows
- `useJobAssignments(createdJobId)` for hiring team rows
- `useJobPostings(createdJobId)` (latest row) for posting summary when filled

No new hooks, no schema changes.

## Files touched

- `src/components/jobs/wizard/SummaryStep.tsx` — full rewrite
- `src/components/jobs/JobWizard.tsx` — pass `hasPosting`, `goToStep`, swap step-5 footer CTAs based on scenario, route `Preview posting` to existing posting preview

## Out of scope

- Real publish/SEO logic beyond toggling status to `open` vs `draft` on submit (already wired)
- Editing inline on Summary — all edits route back to their step
- New Lovable Cloud tables or migrations

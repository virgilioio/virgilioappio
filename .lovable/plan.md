# Step 5 — Review & create

Rebuild `SummaryStep.tsx` to match the reference screenshots. One component, two scenarios driven by whether Step 4 (job posting) was filled or skipped.

## Scenario detection

`hasPosting` is true when Step 4 produced a posting (posting title/description set, ≥1 channel selected, or any custom application field added). Computed in `JobWizard.tsx` from existing posting state + `postingMeta`, passed into `SummaryStep` as a prop. No backend state.

## Header (wizard chrome, already in place)

Eyebrow `CREATE JOB · STEP 5 OF 5`, title `Review & create.`, subtitle:
- filled → "One last look before this job goes live. You can edit anything below by clicking Edit, or after creation in Job Setup."
- skipped → "One last look before this job is created. The public posting step was skipped — this job will be internal-only until you set it up."

## Body sections (single column, in order)

1. **Hero card** — `#0d0d09` bg, cream text, rounded-2xl, briefcase tile.
   - Department badge (purple, small) · `L{level} · {employment_type} · {work_mode}` separators
   - Title (large Poppins + purple `.`)
   - Top-right status pill: filled → green dot `Ready` · skipped → amber dot `Internal`
   - Meta row: `$ {min–max} {currency}` · `↗ {years}` · `👥 {N} hiring team members` · `⌥ {N} pipeline stages`

2. **JOB INFORMATION** — eyebrow + right-aligned `✎ Edit step 1`. White card, 2-col grid of icon · label · value rows: Title, Internal title, Department, Level, Work mode, Locations, Type, Salary. Then `DESCRIPTION PREVIEW` sub-eyebrow + bordered cream box (line-clamp-3 of description). Then `REQUIRED SKILLS · {N}` sub-eyebrow + color-coded skill chips.

3. **HIRING PLAN · {N} STAGES** — eyebrow + `✎ Edit step 2`. Stage rows: numbered colored avatar, name, optional `Required` / `AI` badges, right-side `SLA {value}` chip. Footer summary strip: `✨ AI auto-screen · ≥{N}`, `🕒 Est. time-to-hire {Xd}`, `⊘ Auto-reject rules {N} active`, `📄 Internal form {N} fields default`.

4. **HIRING TEAM · {N} MEMBERS** — eyebrow + `✎ Edit step 3`. Rows of avatar + name + role badge (Recruiter (owner) purple, Hiring manager amber, Panel · {Dept} neutral).

5. **JOB POSTING** — eyebrow + right-side status pill (`• Ready to publish` green / `• Not configured` amber) + `✎ Edit step 4`.

   - **filled** → preview card:
     - Left: branded gradient banner (Acme Talent · Hiring badge + 48h response chip) + slug URL eyebrow + headline + 2-line summary
     - Right: stat rows — Language, Deadline, Application form (`{N} fields · EEO survey on`), Inclusion score, SEO
     - `PUBLISHING TO · {N} CHANNELS` strip + channel tiles (Careers page, LinkedIn slot, WTTJ free, ZipRecruiter $X)
     - Cost banner (dark): `⚡ ${X} + 1 sourcing credit` + "Charged on publish. Cancel anytime."
   - **skipped** → amber empty card "No public posting configured" + body explaining internal-only + `✎ Configure posting` secondary button. Then `WHAT'S SKIPPED` 2x2 muted grid (Careers page listing, Cross-posting to job boards, Public application form, SEO & social card). Then info banner "You can publish this job at any time from Job Setup → Posting."

6. **ON CREATION** — eyebrow + white card with toggle rows. Each row: label + helper · switch on right.
   - `Publish to careers page immediately` — filled: on, helper "Otherwise stays in draft — you can publish later." · skipped: disabled off, helper "Disabled — no posting configured. Add posting info to enable."
   - `Cross-post to LinkedIn, WTTJ, ZipRecruiter` — filled: on, helper "3 free + 1 paid placement. Charged on publish." · skipped: disabled off, helper "Disabled — no posting configured."
   - `Open sourcing project linked to this job` — on, helper changes per scenario ("Gio starts surfacing candidates automatically." / "Gio can still source candidates directly without a public listing.")
   - `Notify hiring team in Slack` — off by default, helper "Send a 'job is live' / internal 'job created' message to #hiring-{dept}."

7. **Closing nudge** (single card under On creation):
   - filled → lilac `Gio is ready to start sourcing` card with `✨ Auto-source` purple action
   - skipped → amber warning `You'll only get candidates through direct sourcing` + `Set up posting now →` purple action (jumps to step 4)

## Sticky footer (override in `JobWizard.tsx` for step 5)

- Left: `← Back`, then `Status on create:` label + pill
  - filled → green `Open · accepting applications`
  - skipped → amber `Internal only · not publicly listed`
- Right:
  - filled → `👁 Preview posting` (secondary) + `✓ Create & publish` (primary)
  - skipped → `⚙ Set up posting` (secondary → jumps to step 4) + `✓ Create job (internal)` (primary)

`Save and exit` stays available behind an overflow if space requires; otherwise omitted on step 5 (matches screenshots).

## Edit-step navigation

`Edit step N` and `Configure posting` / `Set up posting` buttons call a `goToStep(n)` prop wired from `JobWizard` (reuses the same setter the left rail already uses).

## Data sources

- `wizardState.jobData` — all Step 1 fields, skills, description
- `useJobStages(createdJobId)` — hiring plan rows
- `useJobAssignments(createdJobId)` — hiring team rows + role badges
- `useJobPostings(createdJobId)` (latest) — posting preview values when filled
- `postingMeta` already lifted into `JobWizard` — channels count, fields count

No new hooks, no schema/migrations, no edge functions.

## Files touched

- `src/components/jobs/wizard/SummaryStep.tsx` — full rewrite
- `src/components/jobs/JobWizard.tsx` — pass `hasPosting` + `goToStep`, swap step-5 footer CTAs and status pill

## Out of scope

- Real sourcing-project creation / Slack notify wiring (toggles are UI-only on create; existing post-create flows handle the rest)
- Inline editing on the Summary (all edits go back to their step)
- SEO scoring math (read from posting `details` if present, else "Gio generated" placeholder)
- New Lovable Cloud tables, migrations, or RPC

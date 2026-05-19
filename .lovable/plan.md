# Redesign Setup tab — single scrolling page with sticky sidebar

Replace the current 2/3 + 1/3 column layout in `JobSetupLayout.tsx` with the layout from the reference: a sticky "Job setup" sidebar on the left and one long, vertically-scrolling main column on the right, divided into anchor-linkable sections. Sidebar items act as a scroll-spy + smooth-scroll nav.

## Layout

```text
+---------------------+----------------------------------------------+
| JOB SETUP (sticky)  | Hiring plan (stages list)                    |
|  CONFIGURATION      |                                              |
|   • Hiring plan ●   | Auto-rejection rules                         |
|   • Hiring team     |                                              |
|  QUICK LINKS        | AI auto-screen (Gio)                         |
|   • Edit job info   |                                              |
|   • Manage postings | Hiring team                                  |
|   • Activity log    |   Primary recruiter / HM / Reports / Coord.  |
|  [AUTO-SAVED card]  |   Team members                               |
|                     | Notifications                                |
|                     | Close or archive this job                    |
+---------------------+----------------------------------------------+
```

- Sidebar is `lg:col-span-1`, `sticky top-…`, white card, hairline border.
- Main column is `lg:col-span-2`, off-white `#FAFAF7` page surface, sections rendered as white `SectionCard`s matching the wizard / Edit sheet language.
- Sidebar pill states: hover `#F1F0EC`, active = black pill `#0d0d09` with cream text + black-dot indicator (matches Opaline sidebar pattern). Group labels = `text-table-header` style (10.5px caps).
- Auto-saved chip = lilac `#EDE4FF` mini-card with eyebrow "AUTO-SAVED" + "Last edit Xd ago by {name}".
- Scroll spy updates active sidebar item; clicking smooth-scrolls to `data-section="…"`.

## Sections (all live on the same page)

1. **Hiring plan** — keep existing `HiringPlanTab` (stages, SLA chips, Configure, Rename, drag, +Add stage). Header right-side meta: "7 stages · 32-day avg".
2. **Auto-rejection rules** — three toggle rows: Outside listed locations, Salary expectation >25% above range, Same candidate last 90 days. Persists to job-level config (re-use existing `useJobRejectionRules` if present; otherwise add small hook backed by `jobs.auto_rejection_rules` JSONB — confirm before adding columns; for now wire to local state with TODO if column missing).
3. **AI auto-screen** — Gio-purple eyebrow chip top-right. Toggles: Auto-score every application, Auto-reject scores below `<NumberInput /100>`, Generate AI candidate summary.
4. **Hiring team** — Primary recruiter (required, SearchableSelect of members), Hiring manager (required), Reports to (optional), Coordinator (optional, default "Same as recruiter"). Below: Team members table with role dropdown per row and per-row config gear (opens existing scorecard config flow). Re-uses existing `useJobAssignments` + `useMembers`.
5. **Notifications** — Notify owners on new applications, Daily digest at 9:00 AM, Notify hiring team when stage moves (+ Slack channel hint). Toggle-only for v1.
6. **Close or archive this job** — danger-tinted callout card with `Close job` (secondary) + `Archive` (danger outline). Wires to existing `closeJob` / `archiveJob` from `useJobs`.

## Wiring rules

- Every toggle/select must save immediately (optimistic) with debounced persist, mirroring the wizard's auto-save tone — surface the lilac AUTO-SAVED chip + relative time via `formatDistanceToNowStrict`.
- Read-only mode (restricted viewers): all controls disabled, danger card hidden.
- No new DB columns in this pass: rules + AI screen + notifications persist into `jobs.settings` JSONB if it exists, otherwise stub the persistence with a single helper `updateJobSettings(patch)` returning a TODO toast. Confirm before migration.

## Out of scope

- New DB migrations (flag separately if needed).
- Posting setup (lives in its own Postings tab now).
- Re-skinning the stage configurator sheet.

## Files

- Rewrite `src/components/jobs/JobSetupLayout.tsx`.
- New `src/components/jobs/setup/SetupSidebar.tsx`, `SetupSectionCard.tsx`, and one file per section under `src/components/jobs/setup/` for clarity.
- No changes to `JobDetail.tsx` beyond passing the existing props.

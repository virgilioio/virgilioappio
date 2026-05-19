# Step 4 — "Copy from another job" button

Add a pill-shaped dropdown button next to **+ Add question** in the Application form section of Step 4 (Job posting) that lets the user copy the application form (fields list) from another job that already has a job posting.

## UI

- Placement: Application form section header, immediately to the left of **+ Add question** (same `trailing` slot in `SectionCard`).
- Visual: identical to `+ Add question` — `<Button variant="secondary" size="sm" icon={Copy} dropdown>Copy from another job</Button>`.
- Dropdown panel (320px, `align="end"`):
  - `DropdownMenuLabel`: "Copy application form"
  - Search input (shown when 7+ jobs) — reuses our standard menu search pattern.
  - List of eligible jobs: each row shows job title + small muted department/location line, and a right-side chip with field count (e.g., "8 fields").
  - Empty state: "No other jobs have a posting yet."
  - Loading state: 3 skeleton rows.

## Eligibility

A job is shown only if it has at least one `job_postings` row (i.e., `hasPosting`). Current job is excluded. Most-recently-updated first, capped at ~50.

## Behaviour

- Selecting a job fetches that job's posting custom fields and **replaces** the current `fields` array (after a confirm dialog if the current form already has user-modified fields beyond defaults). Replace, not merge — keeps mental model simple and matches "copy from".
- Toast: "Copied {N} fields from {Job title}".
- Does not copy: banner, brand color, channels, description — only the application-form questions.

## Technical notes

- New hook `useJobsWithPostings(excludeJobId)` in `src/hooks/` — selects `jobs` joined/filtered by existence in `job_postings` (single query: `from('jobs').select('id, title, department, ..., job_postings!inner(id, details)')`), scoped by tenant via existing RLS.
- Field extraction: read `job_postings.details.fields` (current shape used by `JobPostingStep` when persisting). Map to the local `FieldDef` shape used in state.
- Files touched:
  - `src/components/jobs/wizard/JobPostingStep.tsx` — add the button + dropdown in the Application form `trailing` slot; wire copy handler.
  - `src/hooks/useJobsWithPostings.ts` — new.
- No schema changes, no migrations, no edge functions.

## Out of scope

- Copying posting description, branding, channels, or hiring plan.
- Cross-tenant copy.
- Versioning / undo (toast is enough; user can still edit/remove fields after copying).

# Smart Field — "Syncs to profile" badge

Replace the inline "syncs to profile" hint text on smart fields placed in the Application form with a proper Gio `<Badge>` so it visually reads as a smart-field marker.

## UI

- On each rendered field card in the Application form list, when the field is a Smart Field (its `type` matches a `SMART_FIELDS` entry), show a `<Badge tone="lilac" size="xs" icon={Sparkles}>Syncs to profile</Badge>` next to the field label (right side of the label row, before the required/locked badges).
- Remove "· syncs to profile" suffix from the salary smart-field `hint` string (and any other smart-field hints that include it) so the info isn't duplicated.
- Tone `lilac` matches the existing "Smart" badge already used in the Add-question dropdown — keeps semantic consistency across the screen.

## Technical notes

- File touched: `src/components/jobs/wizard/JobPostingStep.tsx`.
  - Track smart-field membership via the existing `SMART_FIELDS` array (compare by `type`) or set `isSmart: true` when pushing into `fields` in the Add-question handler so the renderer doesn't need to re-scan.
  - Render the badge in the field row near line ~668 where the label + hint are displayed.
- No schema changes.

# Step 5 — Hiring Team shows user IDs

Bug: the Summary step's **HIRING TEAM** list renders `a.user_id` (raw UUID) as both the avatar initials and the row label.

## Fix

- Resolve each `assignment.user_id` to a `profiles` row (`full_name`, `avatar_url`, `email`).
- Reuse the existing pattern used elsewhere in Job Detail — likely `useProfiles` / `useMembers` hook (or fetch profiles by id list). Check what `HiringTeamPanel` / `JobAssignmentsManager` use and mirror that.
- Render: real avatar (`<Avatar src={profile.avatar_url} fallback={initials(full_name)}>`), full name as the primary label, role badge unchanged.
- Fallback when profile is missing: show email, else "Unknown user" — never the UUID.
- File: `src/components/jobs/wizard/SummaryStep.tsx` (~lines 376–401).

# Step 5 — "Open sourcing project" toggle wires to a real Sourcing tab

When the **Open sourcing project linked to this job** toggle is ON at job creation, create a sourcing project tied to the job and expose it as a new tab inside the Job Detail page.

## New tab layout

`JobDetail.tsx` tabs become: **Pipeline · Job Dashboard · Sourcing · Setup** (Sourcing inserted between Job Dashboard and Setup). Visibility rule: tab is always present, but its content shows an empty-state CTA when no sourcing project is linked yet.

## Behaviour

- On wizard "Create job":
  - If `autoSource` toggle is ON → after job insert, create a `sourcing_projects` row linked to `job_id` (name defaults to job title, seeded with the job's required skills + location + level as initial query hints).
  - If OFF → no project is created; the Sourcing tab shows an empty state with a "Start sourcing for this job" CTA that creates one on demand.
- The Sourcing tab embeds the existing Find/Sourcing UI scoped to that project — reuses the current sourcing components, just with `projectId` preset and the project switcher hidden (or locked to this job's project).

## Technical notes

- Need to confirm the existing sourcing schema (likely `sourcing_projects` table from the Find module) supports a `job_id` foreign key. If not, a migration adds a nullable `job_id uuid references jobs(id) on delete set null` column + index — non-breaking for existing projects.
- New hook `useJobSourcingProject(jobId)` returns the linked project (or null) and an `ensureProject()` mutation.
- `JobWizard` creation step: after `jobs.insert`, if `autoSource` → call `ensureProject(jobId, { seed: { skills, locations, level } })`.
- `JobDetail.tsx`: add `<TabsTrigger value="sourcing">Sourcing</TabsTrigger>` + `<TabsContent value="sourcing">` rendering a new `JobSourcingTab` component that wraps the existing Find UI scoped by `projectId`.
- New file: `src/components/jobs/JobSourcingTab.tsx`.
- Find/Sourcing components stay in place; only a thin "scoped mode" prop is added so the project selector is hidden when embedded in a job.

## Out of scope

- Bidirectional sync of candidates between sourcing project and pipeline (separate feature — sourcing already supports "Add to job" actions).
- Renaming/archiving the linked project from inside the job tab (use the global Find module for that).
- Multiple sourcing projects per job — one linked project per job for v1.

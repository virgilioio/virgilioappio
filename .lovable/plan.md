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

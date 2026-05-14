## Jobs page — fixes pass

Six targeted corrections to match the mockup faithfully and clean up the secondary button across the app.

### 1. Job column — drop avatar
In `JobsTable.tsx`, replace `<IdentityCell>` for the Job column with a plain stack: title (Poppins 14 semi) + inline `Trending` badge, and sub line `{employment_type} · {n} candidates`. No avatar.

### 2. Department → Company
- Rename header label `Department` to `Company`.
- Cell value uses `job.organization_name` (the org / job folder owner) instead of `job.department`.
- Update mobile card meta line accordingly.
- Remove the `Department` filter chip; add a `Company` filter chip populated from unique `organization_name` values.

### 3. Owner column = recruiter / primary user
Resolve the owner via, in order: `job.created_by` (look up in `members` for name + initials), else first `hiring_team_names[0]`. Render as `AvatarStack` (1 avatar, purple, 22px) + first name. No change to layout.

### 4. Pipeline graph — multi-color per-stage bar
Replace the single-color `PipelineBar` with a real segmented bar driven by `usePipelineJobMetrics(visibleJobIds)`:
- Pull `stages[]` per job (id, name, type, count, position).
- Render each stage as a colored segment whose width is `count / totalCount`. Empty stages render a thin gray track segment so the full pipeline shape stays visible (matches mock's gray fill on the right).
- Color palette by `stage_type` (sourcing=blue/cyan, screen=pink, interview=purple, offer=orange/yellow, hired=green, default=gray). Tailwind tokens already in palette.
- Right side: `+N` label using total active candidates (Poppins 11.5 tabular-nums, text-tertiary).
- Tooltip on each segment: `{stageName} · {count}`.
- New file: `src/components/jobs/PipelineBar.tsx` — rewrite.

### 5. Secondary buttons — actually white
Root cause: `--background` token = warm off-gray `#F5F4F0`, and `secondary` variant uses `bg-background`, so it inherits the page color and looks gray.
- Fix in `src/components/ui/button.tsx`: change `secondary` → `bg-white` (keep hairline border, hover `#FAFAF7`, active `#F1F0EC`). Same fix for legacy `outline` alias.
- This corrects the appearance globally, including the JobDetail hero buttons (Share, View posting), without per-call overrides.

### 6. Tabs + filters card
Wrap the status tabs row + the search/filter row inside a single full-width white card with hairline border + 14–16px radius (matches the table card aesthetic).

Layout (inside one `<div className="rounded-2xl border border-virgilio-border bg-white">`):
1. Top row — tabs only, larger style, full width, slight bottom hairline divider:
   - Tabs: `Active (8)`, `All (42)`, `Paused (3)`, `Closed (31)`, `Archived` (no count when 0).
   - Active tab: `bg-[#FAFAF7]` pill, text-primary semibold; inactive: text-tertiary.
   - Replace `TableSegmented` (small, mini-card style) with a new local `JobsListTabs` matching the mock — 14px Poppins, ~40px row height, generous horizontal padding, count in lighter tone.
2. Bottom row — search input full-width on the left, filter chips right-aligned:
   - Search: rounded soft input, larger (h-10), placeholder `Search by title, owner, or department…`, icon left.
   - Filter chips on the right: `+ Company`, `+ Location`, `+ Owner`, `+ Posted`. Use a slightly larger (h-9) FilterChipPopover trigger with leading `+` and label only when inactive, label + value when active. Re-style the trigger in `FilterChipPopover` only via additional className passthrough — no breaking changes elsewhere.

The card replaces the current `TableSegmented` strip and `TableToolbar` block. The data table below remains its own card.

### Files touched
- `src/components/ui/button.tsx` — secondary/outline → `bg-white`.
- `src/components/jobs/PipelineBar.tsx` — rewrite to multi-segment.
- `src/components/jobs/JobsTable.tsx` — drop avatar in JOB col, rename Department→Company, swap data, owner resolution, use new PipelineBar with metrics, drop separate `TableToolbar`/`TableSegmented`, render the new combined card via the page (move toolbar rendering to `Jobs.tsx`).
- `src/pages/Jobs.tsx` — new combined Tabs + Filters card; pass company/owner filters down.
- `src/hooks/useJobsCandidateCounts.ts` — keep for fallback total only (or remove and read totals from `usePipelineJobMetrics`).

### Out of scope
No DB migrations. No changes to Pipeline page or candidate stage logic.

## Jobs list redesign — faithful to mockup

Refresh the `/jobs` page to match the new mockup, mirroring header conventions from `JobDetail` and routing all pills through the unified Badge system.

### 1. Page header (matches JobDetail)

In `src/pages/Jobs.tsx`, replace the empty `PageHeader` band with a self-rendered header (same pattern as `JobHero`):

- Title row: `Jobs` in `font-poppins font-semibold tracking-[-0.04em] text-[28px] sm:text-[32px]` with the purple `.` accent. Inline neutral count chip `42` (`<Badge tone="neutral" size="sm">{total}</Badge>`).
- Summary row beneath title: three dotted Badges — `tone="green" dot` 8 open, `tone="yellow" dot` 3 paused, `tone="neutral" dot` 31 closed (rendered as inline text+dot, not chips, to match the mock's lightweight summary line).
- Right side actions: `<Button variant="secondary" size="md" icon={SlidersHorizontal}>Columns</Button>`, `<Button variant="secondary" size="md" icon={Download}>Export</Button>`, `<Button variant="primary" size="md" icon={Plus}>New job</Button>` — same sizes/styles as the JobDetail hero buttons.

### 2. Status tabs strip

Remove the in-card `FilterChipPopover` for Status. Add a top-level tabs strip directly under the header (outside the table card), styled like Pipeline section tabs:

- Tabs: `Active (n)`, `All (n)`, `Paused (n)`, `Closed (n)`, `Archived (n)`. Counts derived from `jobs` by status (treating the existing `draft` as part of Active group? — clarify below).
- Reuse the existing tab pattern from `PipelineSectionTabs` (rounded pill, active = filled, inactive = ghost) for visual parity with the JobDetail tabs.

### 3. Filter row

Below the tabs (still outside the table card), a single row containing:

- Full-width search input (rounded, soft surface), placeholder `Search by title, owner, or department…`.
- Right-aligned `+ Department`, `+ Location`, `+ Owner`, `+ Posted` filter chips (reuse `FilterChipPopover` with the `+` prefix style from the mock). Department/Location/Owner already exist in data; Posted = date filter chip (today / 7d / 30d / all).
- All controls use the standard 32–34px height per style guide.

### 4. Table redesign — full Tables Foundation v1

Rewrite `JobsTable` body using `<Table density="default">` and the column primitives from the style guide:

| Column | Primitive | Notes |
|---|---|---|
| JOB | `IdentityCell` | Title (Poppins 14 semi) + inline `Badge tone="purple" size="xs"` for `Trending` when applicable. Secondary line: `{employment_type} · {candidate_count} candidates` (`text-table-meta`). |
| DEPARTMENT | text | Plain text cell. |
| LOCATION | text | `{location_mode} · {location}` formatting. |
| STAGE | `StatusCell` | Single Badge with `dot`, tone mapped per stage (Sourcing=blue, Screen=pink, Interview=purple, Offer=yellow, Hired=green). |
| PIPELINE | custom | Segmented multi-color bar (gray→blue→purple→orange) reflecting per-stage candidate counts, with `+N` neutral chip on the right. New `PipelineBar` presentational component. |
| DAYS OPEN | `NumericCell` | `{n}d` Poppins tabular-nums; tone red when `> SLA` (e.g. ≥21d), neutral otherwise. |
| OWNER | `ComposedCell` | Purple `AvatarStack` (single) + first name. |
| (actions) | `ActionCell` | Kebab opacity 0→1 on row hover, 32px column. |

Header row uses `text-table-header` (10.5 caps, +0.06em). No vertical dividers. Solid `#FAFAF7` header. Hover = flat `#FAFAF7`. Selected = lavender + 2px purple left rail (already in primitives).

Footer: `TableFooterSummary` ("8 of 42 jobs") instead of pagination — list is short and matches the mock.

### 5. Empty / loading / mobile

- `TableSkeleton` (3–5 rows) for loading.
- `TableEmpty` (with mascot) when no jobs at all, `TableFilteredEmpty` for filtered.
- Mobile (`lg:hidden`) keeps the stacked Card view but rebuilds the rows using the same Badge tones for stage/status. No subtitle on PageHeader on mobile either.

### 6. Badge / tag system migration (project-wide guideline reinforced here)

- Replace all `Badge variant="job-open|job-draft|job-closed|job-archived"` usages in this page with the compositional API: `<Badge tone="green|neutral|yellow|ink" dot size="xs|sm">`.
- Trending uses `<Badge tone="purple" size="xs">Trending</Badge>`.
- Stage badges use `<Badge tone={stageTone} dot size="sm">`.
- Count chip in title: `<Badge tone="neutral" size="sm">{n}</Badge>` (no dot).

### Files to touch

- `src/pages/Jobs.tsx` — new header, tabs strip, filter row, layout.
- `src/components/jobs/JobsTable.tsx` — strip search/status/action rows; convert to Tables Foundation primitives + new columns.
- `src/components/jobs/PipelineBar.tsx` — new tiny presentational component.
- (No data/hook/query changes; pipeline counts derive from existing job fields, defaulting to 0 segments when not yet populated.)

### Open question

The mock shows tabs `Active / All / Paused / Closed / Archived` but our DB enum is `draft | open | closed | archived` (no `paused`). Two options:

1. Map `Paused = draft` (rename label only) — fastest, no migration.
2. Add a real `paused` status to the enum + data layer.

Default to **option 1** unless you say otherwise; this keeps the change purely presentational.

# Job page — kill the side menu, finish the mockups

Frontend-only. No data, hooks, RLS, or routes change. We're realigning navigation and three tab surfaces (Pipeline, Job Dashboard, Setup) to the screenshots.

## 1. Remove the floating side menu

- Delete `src/components/jobs/JobDetailFloatingSidebar.tsx` and all imports/usages in `src/pages/JobDetail.tsx`.
- Drop the side rail wrapper around the page body. The page becomes a single column under `JobHero`.
- Move the Sourcing Project shortcut (currently inside the floating sidebar) into `JobHero`'s right action cluster as a small `ghost` button (single project → link, multiple → popover) — preserves access without the rail.

## 2. Top-level tabs (desktop + mobile, identical)

Replace the current desktop "no tabs" branch and the mobile 3-grid with a single underlined `Tabs` matching the mockup:

```
Pipeline    Job Dashboard    Setup
─────────
```

- Underline-style triggers (no boxed/pill background), `text-h5` weight, active = bold + 2px purple/foreground underline. Reuse existing `Tabs` primitive; style via local `TabsList`/`TabsTrigger` className overrides — no new component.
- Restricted viewers (HM/Interviewer): only `Pipeline` is shown.

## 3. Pipeline tab

Already partly built. Remaining gaps vs `05_Pipeline_board_view`:

- **Section row (`PipelineSectionTabs`)**: confirm hairline border container, count chips with the right tone per section (Suggested = `Sparkles` icon + neutral count, Application = `pastel-purple`, Recruiting = `pastel-yellow`, Offers = `pastel-blue`, Hired = `success/15`, Rejected = `destructive/15`), active = filled pastel background.
- **Toolbar**: replace the `CardHeader` "Pipeline Overview" + paragraph with a flat toolbar row using existing `TableToolbar`, `TableSearch`, `TableSegmented` (Board/List), a `Select` for sort, and `<Button variant="primary" icon={UserPlus}>Add candidate</Button>`. Keep `2 filters` pill via `TableFilterPills`.
- **Board columns** (`PipelineOverview.tsx`): column header = colored dot (`getStageDotColor`) + bold stage name + muted count, no card chrome around the column body, dashed `+ Add candidate` drop zone at the bottom of each column.
- **Card** (`CandidateCard.tsx`): trim to mockup — avatar, name (semibold), `Title @ Company` muted, footer row `✦ <score>` + `🕐 Xd` (+ `Due tmrw` chip / heart when applicable). Drop extra meta.

## 4. Application Review (inside Pipeline → Application section)

Build this surface to match `06_Application_Review`:

- **Lilac AI banner** above the toolbar using existing `Alert` + standardized AI banner styles (Sparkles icon, "Gio has reviewed N new applications", subtitle "X ranked strong fit · Y worth review · Z likely no-fit. Sorted by AI fit score by default.", right-aligned `Review queue` purple button, dismiss `×`).
- **Toolbar**: `TableSearch` ("Search applicants…"), `Select` "Sort: AI fit · descending", right side muted text "N in queue · M over 5 days" + `Start review` primary button.
- **Table** (reusing `Table` + cell primitives, density="default"):
  - Columns: `#`, `CANDIDATE` (`IdentityCell` with avatar + name + `Title · Company`), `TOP SKILLS` (Badge row + `+N` overflow), `AI FIT` (numeric + tiny inline trend sparkline — render as colored SVG path, no library), `APPLIED` (relative `Xd`), `STATUS` (`StatusCell` with mail icon + label e.g. "AI summary ready", "Auto-screened ✓", "Awaiting screen", "Low fit · review"), `ACTIONS` (`ActionCell` with red ghost `X` + primary black `✓`).
  - Selected row uses the standard 2px purple left rail.

## 5. Setup tab — full rebuild

Discard `JobSetupPanel`'s internal sub-tabs (Overview / Hiring Team / Hiring Plan / Job Postings). The Setup tab becomes one screen matching `07_Job_Setup`:

- 2-column grid `lg:grid-cols-3`:
  - **Main (col-span-2)**:
    - `Job description` card — title left, `Edit` ghost button right, body renders the description (bullet lists, headings) from `JobOverviewTab` data. Reuse existing rich-text rendering.
    - `Hiring stages` card — title left, `+ Add stage` ghost button right. List of stage rows with drag handle, numbered colored circle (uses stage dot color), stage name (bold) + sub-label ("Auto-screened by Gio", "30 min · Recruiter", "5–7 day async", …), trailing `…` menu. This is the existing hiring-plan editor restyled to a flat list — no card-in-card.
  - **Right rail (col-span-1)**:
    - `Status` card: rows for Status (open badge), Posted (Xd ago), Target start, Slots ("1 of 2 filled").
    - `Compensation` card: large centered `$185k – $210k`, `base · plus equity & bonus` muted line, lilac AI insight chip (`Above market median for SF · 80th percentile in NYC`).
    - `Hiring team` card: title + `+ Add` ghost button, member rows with avatar + name + role label.
- Postings move into a `…` overflow on the Setup header (or are accessible from `JobHero`'s `View posting`); we are not creating a new tab for them in this pass.
- `HiringTeamTab`, `HiringPlanTab`, `JobOverviewTab`, `JobPostingsTab` files stay — we reuse their data wiring inside the new Setup layout instead of mounting them whole.

## 6. Mobile parity

- Same three top tabs, same Setup layout but stacked single-column (rail cards drop below main).
- Pipeline mobile keeps the existing `Select` section picker but switches the trigger styling to a plain underlined dropdown to match the section pills visually.
- Drop `JobDetailMobileHeader`'s "menu" affordance (no more side menu to open).

## Files

- delete: `src/components/jobs/JobDetailFloatingSidebar.tsx`
- edit: `src/pages/JobDetail.tsx` (remove sidebar + restricted side rail, rewire top tabs, plug new Setup layout, mount new ApplicationReviewSection)
- edit: `src/components/jobs/JobHero.tsx` (add Sourcing Project entry point)
- edit: `src/components/jobs/PipelineSectionTabs.tsx` (tone polish per mockup)
- edit: `src/components/jobs/PipelineOverview.tsx` (toolbar swap, column header restyle, dashed add-candidate dropzone)
- edit: `src/components/jobs/CandidateCard.tsx` (trim to mockup)
- new: `src/components/jobs/ApplicationReviewSection.tsx` (banner + toolbar + table, uses existing primitives only)
- new: `src/components/jobs/JobSetupLayout.tsx` (2-col layout: Job Description + Hiring Stages on left; Status/Compensation/Hiring Team rail on right) — replaces `JobSetupPanel` as the Setup tab content
- edit: `src/components/jobs/JobDetailMobileHeader.tsx` (remove menu toggle)

## Out of scope

- No backend, no schema, no new hooks/queries, no route changes.
- No edits to `HiringTeamTab` / `HiringPlanTab` / `JobOverviewTab` / `JobPostingsTab` internals beyond what's needed to embed their UI inside the new Setup layout.
- Job Postings tab is folded under Setup overflow for now; full Postings redesign is a separate pass.

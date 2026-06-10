## Pipeline Page Rebuild — Strict Spec

Rebuild `/pipeline` from scratch to match the provided design exactly. Scope is **only** the Pipeline page and a new reusable `MetricStrip` primitive.

### New components

1. **`src/components/ui/metric-strip.tsx`** — reusable `<MetricStrip items={...} />` + internal `<MetricCell />`.
   - White card, radius 12, `#E7E8EE` border, padding 0, ~56h. Cells `flex-1` divided by `1px #F1F0EC`.
   - Cell: 28×28 tinted icon chip (tones: purple/yellow/green/blue/pink/neutral), Inter 11/500 `#8B8F9E` label, Poppins 19/600 `-0.03em` value `#0d0d09` + optional `d` suffix 12/500 `#5A6072`.
   - Qualifier slot: delta (arrow + number, green improving / red worsening; supports inverted metrics like time-down=green) OR amber annotation `#B45309`. Zero state = muted `#B5B9C4`.

2. **`src/components/pipeline/PipelineFilterBar.tsx`** — white card, padding 10. Controls: Views pill (bookmark), Search input (30h, `#F6F5F1` bg), pills Status/Owner/Department (active = purple), hairline divider, Sort pill "Recent activity", **Group** toggle (rows-3), **Expand all/Collapse all** toggle.

3. **`src/components/pipeline/StageFunnelBar.tsx`** — fixed 360w. One 20h segment per stage with 2px gaps; width ∝ `count + 0.45`. Filled ramp `#ADB2BD → #C9B8FB → #A98BFA → #8456F6 → #6F3FF5`. Empty = same color @18% opacity. White 10.5/600 centered count. 9px `#8B8F9E` truncated stage labels below. Tooltip on hover.

4. **`src/components/pipeline/JobPipelineRow.tsx`** — replaces current `JobRow`. Collapsed: chevron, title (Poppins 13.5/600) + green Open chip + attention flags (amber `clock-alert` "N idle >7d", gray `moon` "quiet 6d"), meta line (building/map-pin/activity, 11.5 `#8B8F9E`), funnel bar (360w), active count (Poppins 16/600 over "active" label, muted if 0), 22px avatar stack (max 3), 28px more-button. Whole card toggles. Card padding 12×16, radius 12.

5. **`src/components/pipeline/InlineKanban.tsx`** — expansion panel `#FAFAF7` with top hairline, 12 padding.
   - Summary row "N active candidates · N stages" + right actions: ghost "Add candidate", secondary "Open board" → `/jobs/:id`.
   - Equal-width column grid, 8px gap. Column: white, radius 10, `#E7E8EE` border. Header: 6px stage dot, name (Poppins 11/600), count, `+` icon. Body `#FCFCFA` min-h 76.
   - **Candidate row** (`InlineCandidateRow.tsx`): white, radius 7, padding 5×8 — 18px avatar, name (Inter 11.5/500), days-in-stage `Xd`. Idle (>7d) = amber clock-alert + amber bold count + amber avatar tint. Click → open profile.
   - **DnD** between stages of same job via `@dnd-kit`. Drop target highlight `#EDE4FF/40` + `#D7C5FB` border. Empty column dashed "Empty"/"Drop here". On drop, call existing `useCandidateStageMove` (or equivalent) and reset days counter optimistically.

### Page rewrite — `src/pages/Pipeline.tsx`

- Page bg `#F6F5F1`. Custom header (not `PageHeader`) per spec: title "Pipeline" + meta line `{N} open jobs · {M} active candidates · Updated {x}` + right actions Export (download icon, secondary) and "New job" (primary purple, plus icon → `/jobs/new`).
- 12px gap → `<MetricStrip items={[active jobs · purple · ↑Δ, in app review · yellow · annotation, active candidates · green · ↑Δ, avg days in review · blue · ↓Δ green]} />`.
- 10px gap → `<PipelineFilterBar />`.
- 8px gap → result count line "Showing X of Y open jobs · sorted by recent activity" (Inter 11.5 `#8B8F9E`).
- 12px gap → vertical job list, 10px gap. When Group is on, render uppercase 11px section headers per department with count + hairline.
- Expand state: `Set<jobId>` (multi-expand). Expand/Collapse all toggles all visible.
- Empty search: centered card "No jobs match \"query\"".
- Drop existing `MetricCard` hero strip, `MetricCardGroup`, `Accordion`, and current `JobRow`.

### Data

- Reuse `useJobs`, `useMembers`, `useOrganizations`, `usePipelineGlobalMetrics`, `usePipelineJobMetrics`.
- `globalMetrics` already returns `active_jobs`, `application_review_count`, `active_candidates_count`, `avg_days_in_application_review` — feed directly into the strip. Deltas: omit if not in payload (no fake data); keep cells without qualifier per spec ("zero state never hidden"). Annotation for "In application review" shown only if backend exposes an `over_X_days` field — otherwise omit annotation.
- `jobMetrics.stages` drives the funnel bar (per-job stages).
- For inline kanban candidate lists, reuse `usePipelineOverviewData(jobId)` (already used by `PipelineOverview`) to fetch candidates per stage, plus the existing stage-move mutation it uses for DnD.

### Files

- **New:** `src/components/ui/metric-strip.tsx`, `src/components/pipeline/PipelineFilterBar.tsx`, `src/components/pipeline/StageFunnelBar.tsx`, `src/components/pipeline/JobPipelineRow.tsx`, `src/components/pipeline/InlineKanban.tsx`, `src/components/pipeline/InlineCandidateRow.tsx`.
- **Rewritten:** `src/pages/Pipeline.tsx`.
- **Untouched (deprecated for this page but kept):** `src/components/pipeline/JobRow.tsx`, `PipelineMetricCard.tsx`, `FilterCard.tsx`.

### Non-goals

- No backend / RPC changes. No new tables. No changes to job board pages. No new global tokens.

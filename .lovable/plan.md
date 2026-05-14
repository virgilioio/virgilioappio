Frontend-only pass — no schema, hooks, or queries change. Each section is a small, scoped edit.

## 1. Stage columns — container + colored DnD highlight (`PipelineOverview.tsx`)

Match the mockup: every column sits inside its own light "shell" with a subtle border. The shell tints to the stage color and shows a dashed dropzone outline only while a card is being dragged over it.

- Wrap each column body in a tinted shell:
  ```text
  rounded-2xl border border-virgilio-border/60 bg-[#FAFAF7] p-2
  ```
  Header row stays at the top (dot + name + count). The droppable area + cards + bottom Add-candidate sit inside the shell.
- Replace `<DroppableStage>` usage with a new local droppable wrapper (or extend it) that exposes `isOver` to the parent so we can:
  - On `isOver`, swap shell bg to the stage tint (reuse `getHeaderBgClass(stage_type)` → `bg-pastel-blue/30`, `bg-pastel-purple/30`, `bg-success/20`, etc.) and add `ring-1 ring-inset ring-{stageColor}/40`.
  - Render an inset dashed outline overlay (`absolute inset-1 rounded-xl border border-dashed border-{stageColor}/60 pointer-events-none`) only while `isOver`.
- Empty-column dashed placeholder stays, but lives inside the shell (full height).
- Bottom "+ Add candidate" button stays dashed but moves inside the shell with `mt-2`.

Color map per stage_type for the highlight ring/outline (reuse existing tokens):
- application/screening → `info`
- interview → `virgilio-purple`
- assessment → `warning`
- reference_check → `pastel-orange`
- offer → `success`
- onboarding → `pastel-green`
- default → `text-tertiary`

## 2. Wire bottom "+ Add candidate" button (`PipelineOverview.tsx` + `JobDetail.tsx`)

- Add prop `onAddCandidateClick?: () => void` to `PipelineOverview`.
- Wire the dashed bottom button to `onAddCandidateClick?.()` (no per-stage prefill — same sheet as the top-right "Add candidate").
- In `JobDetail.tsx`, pass `onAddCandidateClick={() => setShowAddCandidate(true)}` to all `PipelineOverview` mounts.

## 3. Wire pipeline search (`JobDetail.tsx` + `PipelineOverview.tsx`)

- Add prop `searchTerm?: string` to `PipelineOverview`. Apply it client-side inside `sortedByStage` and `listRows` by lowercasing and matching against `assoc.candidate_name`, `candidate_role`, `candidate_company`.
- In `JobDetail.tsx`, pass `searchTerm={pipelineSearch}` to both desktop and mobile mounts.
- Keep the existing internal `search` state for list view as a fallback when no external term is provided.

## 4. Board / List toggle icons (`JobDetail.tsx`)

The existing `TableSegmented` only supports `label` + optional `count`. Extend it minimally:

- In `src/components/ui/table-toolbar.tsx`, add an optional `icon?: React.ComponentType<{ className?: string }>` to `TableSegmentedOption`. Render `<Icon className="h-3.5 w-3.5" />` before the label when present. No other behavior changes.
- In `JobDetail.tsx`, pass `LayoutGrid` for Board and `List` for List (already imported).

## 5. Section tab font size (`PipelineSectionTabs.tsx`)

Style guide says in-page tabs use `text-ui-tab` (12.5px Poppins 500 / 600 active). Current pills use 14px.

- Swap `text-[14px]` → `text-ui-tab` (or explicit `text-[12.5px]`).
- Keep `font-medium` default, `font-semibold` active. Keep height `h-10`, padding/chip unchanged.
- Count chip: drop one notch — `h-5 min-w-5 text-[11px]` to match the smaller label.

## 6. Global app background — neutral gray (`src/index.css`)

Mockup uses a warm off-gray (≈ `#F5F4F0`) for everything outside white cards.

- Update `--background` in `:root` from pure white to a single gray token derived from existing palette: `--background: 48 14% 96%;` (renders ≈ `#F5F4F0`, matches the cream/citron family already in use).
- Verify cards/inputs that previously used `bg-background` still read as white where intended; if any surface now blends, switch those specific surfaces to `bg-white` (expected list: `Card` already uses `bg-card` which is separate, so no change needed). Spot-check: PipelineOverview shell uses explicit `#FAFAF7`, candidate cards use `bg-white`, top nav uses citron-noir — all unaffected.
- No dark-mode change.

## 7. Compensation card — real data only (`JobSetupLayout.tsx`)

- The card already reads `salary_min`/`salary_max`/`currency`. Keep that.
- Below the formatted salary, render dynamic facts from `job` only:
  - Pay period if present (e.g. `job.salary_period` → "per year") rendered as the subtitle. Fall back to "base salary" only when no period exists.
  - If `job.equity` / `job.bonus_structure` exist, list them as small rows; otherwise render nothing.
- **Remove** the hard-coded lilac "Above market median for SF · 80th percentile in NYC" Sparkles note entirely.
- If no salary is configured, render a single muted line "Not set" instead of hiding the card (so the rail stays balanced).

## Files touched

- `src/components/jobs/PipelineOverview.tsx` — column shell, colored DnD highlight, bottom Add-candidate handler, search prop.
- `src/components/jobs/DroppableStage.tsx` — expose `isOver` (or render colored dashed overlay internally driven by `tintClass`/`stageColor` props).
- `src/components/jobs/PipelineSectionTabs.tsx` — font size + chip size.
- `src/components/ui/table-toolbar.tsx` — `TableSegmented` optional `icon`.
- `src/pages/JobDetail.tsx` — pass `searchTerm`, `onAddCandidateClick`, segment icons.
- `src/components/jobs/JobSetupLayout.tsx` — drop hard-coded note, render real comp data.
- `src/index.css` — `--background` to warm gray.

## Out of scope

No backend, RLS, hooks, queries, routes, or new tables. Mobile-only adjustments beyond what falls out of the shared components above. The List view styling and Suggested/Hired/Rejected tabs remain as-is.

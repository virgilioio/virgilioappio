## Goal
Match the mockup's structural framing for the Job detail header, status tabs, and pipeline toolbar.

## Changes (frontend / presentation only)

### 1. Wrap the Job header in a white card
File: `src/pages/JobDetail.tsx`

Group **JobHero + top tabs (Pipeline / Job Dashboard / Setup)** inside a single white card container:
- `bg-white border border-virgilio-border rounded-2xl shadow-sm`
- Internal padding ~ `px-6 pt-5 pb-0`
- Move the existing `<JobHero>` and `<TabsList>` inside this wrapper.
- Remove the bottom-border on `TabsList` (the card edge replaces it). Keep the per-trigger underline indicator.
- Card sits below the global app chrome with the warm gray background showing around it.

### 2. Wrap the Pipeline status tabs in a white card
File: `src/components/jobs/PipelineSectionTabs.tsx` (or wrap in `JobDetail.tsx`)

Wrap the status pills row (Suggested / Application review / Recruiting process / Job offers / Hired / Rejected) in:
- `bg-white border border-virgilio-border rounded-xl px-3 py-2`
- Pills remain evenly spaced inside (`flex items-center justify-between` or `gap` distribution preserved).
- Active pill keeps its tinted background; inactive pills stay transparent on the white card.

### 3. Align the toolbar row (search + right buttons)
File: `src/pages/JobDetail.tsx` (toolbar block around line 959)

- Ensure `TableToolbar` row is visually a single aligned row: search on left, filter button next to it; right cluster (Board/List segmented + Select + Add candidate) right-aligned, all at the same height (`h-9`).
- All elements share the same corner radius (`rounded-lg`) so they "square up".
- Remove any wrapping/flex-wrap; use `flex items-center justify-between gap-3` and consistent control sizes (`size="sm"` Buttons, `h-9` search).
- Add a primary "Add candidate" button (`variant="primary"`, `icon={UserPlus}`) to the right cluster on the recruiting tab to mirror the mock — wired to `setShowAddCandidate(true)`.

### 4. Background spacing
Confirm warm-gray `--background` shows between: header card → status-tab card → toolbar/board area, with `space-y-3` (12px) gaps to match the mockup rhythm.

## Out of scope
- No data, hook, route, or backend changes.
- No restructuring of `PipelineOverview` columns (already done in prior pass).

## Files touched
- `src/pages/JobDetail.tsx` — wrap header, regroup toolbar, add primary Add-candidate.
- `src/components/jobs/PipelineSectionTabs.tsx` — outer white card wrapper.

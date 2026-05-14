## Goal
Polish three pieces of the Pipeline Board to match the mockup.

## 1. Candidate card title typography
File: `src/components/jobs/CandidateCard.tsx`

- Title (candidate name): `font-poppins text-[14px] font-semibold tracking-[-0.01em] text-text-primary leading-[1.15]`.
- Role + company become **two stacked lines** (matching mock):
  - Line 1: `current_role` (e.g., "Designer") — `text-[12px] text-text-secondary leading-tight`.
  - Line 2: `@ {current_company}` — `text-[12px] text-text-tertiary leading-tight`.
- Drop the inline "Designer @ Notion" single-line treatment.
- Avatar stays 32px purple.

## 2. Stage column = single container with header + divider + body
File: `src/components/jobs/PipelineOverview.tsx`

Restructure each column so the **stage header is INSIDE** the column container (currently it sits above the gray ColumnShell):

```
┌─ rounded-2xl white card, border virgilio-border ──┐
│  Header row (px-3 py-2.5):                        │
│    • dot + stage name (14px Poppins semibold)     │
│      + count (12px tabular-nums text-tertiary)    │
│    • [zap icon] [bulk checkbox] [⋯ on hover]      │
│  ── 1px divider (border-virgilio-border) ──       │
│  Body (p-2, gap-2):                               │
│    candidate cards…                               │
│    + Add candidate (dashed, full width)           │
└───────────────────────────────────────────────────┘
```

- Refactor `ColumnShell` to accept a `header` ReactNode and render: header → `<div className="border-t border-virgilio-border" />` → body.
- Default background: `bg-white`. On `isOver` (DnD), tint background and inner dashed dropzone using existing `STAGE_HOVER_CLASSES` (this is the lavender effect on Take-home in the mock).
- On empty (no cards, not dragging), keep a subtle dashed body indicator and the "+ Add candidate" button as the only visible action.
- Remove the separate header `<div className="px-1 pb-2 pt-1 ...">` block that currently sits above ColumnShell — fold its contents into the new header slot.
- Stage dot keeps `getStageDotColor()`.

## 3. Cancel selection mode
File: `src/pages/JobDetail.tsx` (toolbar right cluster, around line 995)

- Currently the Cancel button only shows when `selectedCandidateIds.length > 0`. Change so the **Cancel button shows whenever `selectionMode` is true**, regardless of selection count.
- Clicking it sets `setSelectionMode(false)` and clears `setSelectedCandidateIds([])`.
- When selectionMode is on but nothing selected: show only the Cancel button (no Email/Reject yet). When something is selected: show Email + Reject + Cancel.
- Hide the "Select" toggle button while `selectionMode` is true (so Cancel replaces it visually).

## Out of scope
- No changes to data, queries, or board DnD logic.
- No card body redesign beyond the title/subtitle typography.

## Files touched
- `src/components/jobs/CandidateCard.tsx`
- `src/components/jobs/PipelineOverview.tsx`
- `src/pages/JobDetail.tsx`

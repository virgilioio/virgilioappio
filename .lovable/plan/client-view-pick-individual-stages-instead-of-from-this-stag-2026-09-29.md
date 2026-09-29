# Client view — pick individual stages instead of "from this stage on"

## Current behavior (confirmed)
`job_pipeline_shares.from_stage_id` stores one start stage; the client sees that stage and everything after it. Consumers: `ClientViewSection.tsx` ("Visible from" card), `pipeline-public` edge function (line ~84, slices stages from the start index), `PipelineOverview.tsx` (line ~762, eye icons derived from the same slice).

## Change: per-stage selection
Clicking a stage chip toggles that stage on/off for the client, independently of the others.

### Data
- Migration: add `visible_stage_ids uuid[]` (nullable) to `job_pipeline_shares`. Backfill from `from_stage_id` (that stage + all later recruiting stages) so existing shares keep their current visibility. Keep `from_stage_id` column for now (no destructive drop) but stop reading it.
- Guard: at least one stage must stay selected — the last selected stage can't be unselected while the view is live (or turning off the last one turns the whole view off; choose: block with a toast "At least one stage must be visible").

### UI — `ClientViewSection.tsx` "Visible from" card
- Each recruiting-stage chip is an independent toggle: click selects (purple styling + Eye) or unselects (neutral + EyeOff). No more "everything after" fill.
- Update the summary line to list the selected stages (e.g. "Screen, Interview, Final") and the candidate count across exactly those stages. Rename the card title/subtitle to "Visible stages" — "The client sees only the stages you select."
- Live badge "Live · from X" becomes "Live · N stages".
- Default when first enabling: all recruiting stages selected.

### Consumers
- `useJobPipelineShare.ts`: add `visible_stage_ids` to the type; toggle helper.
- `pipeline-public` edge function: filter stages/candidates by membership in `visible_stage_ids` instead of slicing from an index.
- `PipelineOverview.tsx` eye/eye-off column icons: visible iff the column's stage id is in `visible_stage_ids`.

### Verify
- Typecheck/build clean; deploy edge function; confirm toggling a middle stage no longer selects its neighbors.

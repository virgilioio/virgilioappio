# Add to Job — 4-step popover from bulk bar

Replaces the existing `BulkAddToJobPipelineDialog` (a flat Job/Stage dialog) with a guided 4-step popover anchored to the **Add to job** button in `BulkActionBar`. Same end action (`createAssociationAndMove` per candidate), but better signal, fewer mistakes, and explicit duplicate handling.

## The four steps

```text
[1] Pick job          [2] Pick stage         [3] Resolve duplicates    [4] Confirm
─────────────         ─────────────          ──────────────────────    ───────────────
Recent (3)            Pipeline preview       N already in pipeline     "3 added to
Open jobs (search)    with live counts       per-row: Skip / Move      Senior Designer"
                      per stage                                        mini pipeline preview
```

### 1. Pick job
- Anchored popover (520w) opens from **Add to job** in the bulk bar.
- Header: "Add N candidates to a job".
- **Recently used** (top 3 jobs the user has interacted with) + **Open jobs** list below.
- Inline search input (filters open jobs by title + org).
- Archived/closed jobs hidden.
- Click a job → step 2.

### 2. Pick stage
- Full vertical pipeline preview for the selected job (all stages in order).
- Each stage row: dot · stage name · live candidate count badge.
- Default selection: the first stage (Application Review or position 0).
- "Back" returns to step 1. Click stage → step 3 (or skip to 4 if no duplicates).

### 3. Resolve duplicates
- Only shown when at least one selected candidate already has an association on this job.
- Top summary: "X of N already in this pipeline".
- Per-duplicate row: avatar · name · current stage badge · `Skip` / `Move here` toggle (default **Skip**).
- Bulk toggle at top: "Skip all" / "Move all to {stage}".
- Non-duplicates listed below as "Will be added" (read-only).
- "Back" → step 2, "Continue" → step 4.

### 4. Confirmation
- Mini pipeline preview of the target job with the projected new counts (delta highlighted in lilac).
- Summary line: "X added · Y moved · Z skipped".
- Primary button "Add to pipeline" runs the mutations.
- On success: toast with Undo, popover closes, bulk selection clears, table refreshes.

## Technical

- **New component**: `src/components/candidates/bulk/AddToJobPopover.tsx` — single `<Popover>` with internal `step: 1|2|3|4` state machine.
- **Bulk bar wiring**: `BulkActionBar` gains an optional `addToJobButtonSlot` (mirror of existing `tagButtonSlot`); `Candidates.tsx` passes `<AddToJobPopover candidateIds={selectedIds} />` and removes `BulkAddToJobPipelineDialog` + `bulkJobOpen` state.
- **Data**:
  - Jobs: `useJobs()` (filter `status === 'open'`). Recent jobs derived from a small `localStorage` ring (`recent-add-to-job-jobs`, last 3 ids, pushed on confirm).
  - Stages: `useJobHiringPlan().loadHiringPlanInstances(jobId)` — already returns ordered stages.
  - Stage counts: lightweight count query on `candidate_job_stages` grouped by `job_hiring_stage_id` for the chosen job (one query per job, cached per popover session).
  - Duplicates: for the chosen job, query `candidate_job_associations` where `candidate_id IN selectedIds AND job_id = X`; join current stage name for display.
- **Mutations**: reuse `usePipelineActions().createAssociationAndMove`. For "Move here" on duplicates, the same function updates the stage. Run as `Promise.allSettled` with per-row error toasts on partial failure.
- **Permissions**: unchanged — `useJobsForCandidateAssignment` patterns already gate job visibility.
- **Styling**: design system tokens only. Popover follows dropdown foundation (radius 12, pad 4, shadow `0 12px 32px -8px black/18`). Primary button = default `<Button>`. Stage dots reuse the kanban stage color tokens.

## Out of scope

- Creating a new job from this flow.
- Cross-tenant or archived jobs.
- Editing stage order, automations, or scorecards from the preview.
- Email/notify candidate on move (kept on existing stage-change automations).

## Files

- New: `src/components/candidates/bulk/AddToJobPopover.tsx`
- Edited: `src/components/candidates/list/BulkActionBar.tsx` (add `addToJobButtonSlot`)
- Edited: `src/pages/Candidates.tsx` (mount popover, drop dialog state)
- Removed usage (file kept for now): `src/components/candidates/BulkAddToJobPipelineDialog.tsx`

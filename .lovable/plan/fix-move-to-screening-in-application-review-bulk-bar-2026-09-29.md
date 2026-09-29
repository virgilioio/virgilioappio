# Fix "Move to Screening" in Application review bulk bar

## What's wrong today
- The label "Move to Screening" is fixed text. It never looks at your pipeline.
- The button isn't connected to anything, so clicking it does nothing (no move happens at all).
- The single-row "Advance to screening" action picks a "screening"-type stage, or otherwise any other stage in no fixed order, so it could land candidates in the wrong stage.

## The fix
- Work out the **next stage** once: the first stage after Application review in your pipeline order (ignoring Offer/Onboarding), using the stage's custom name if you renamed it.
- Bulk bar button reads **"Move to [that stage]"** (e.g. "Move to Phone interview") and moves every selected candidate there, then refreshes the list, clears the selection and shows a toast ("5 candidates moved to Phone interview"; failures reported separately).
- Row action reads **"Advance to [that stage]"** and uses the same stage.
- If the job has no stage after Application review, the button is disabled with the tooltip "Add a stage to this pipeline first".

## Technical details
- `src/pages/JobDetail.tsx`: load `position` and `custom_stage_name` in the stage-map query; replace `screeningStageId` with `nextStageId`/`nextStageName` (lowest position after the application_review stage, excluding offer/onboarding); add `onBulkMoveStage` that runs `moveAssociationToStage` for selected associations via `Promise.allSettled`; pass `nextStageName` into the section config.
- `src/components/jobs/sections/pipelineSectionConfigs.tsx`: add `nextStageName?: string` to `PSHandlers`; build labels from it; disable when absent.
- No backend or data changes.

## Problem

In `src/components/jobs/JobWizard.tsx`, `handleNextStep` always calls `submitStep1()` when leaving step 1, and `submitStep1()` always calls `createJob(...)`. There is no check for `wizardState.createdJobId`. So if a user goes Step 1 → Step 2, then back to Step 1, edits, and clicks "Create & continue" again, a second job row is inserted.

## Fix (frontend-only, single file)

Edit `src/components/jobs/JobWizard.tsx`:

1. Pull `updateJob` alongside `createJob` from `useJobs()` (line 133).
2. In `submitStep1()` (lines 180-201), branch on `wizardState.createdJobId`:
   - If **no** `createdJobId` → call `createJob(payload)` as today, store returned id in `createdJobId`.
   - If `createdJobId` already exists → call `updateJob(createdJobId, payload)` instead, return `{ id: createdJobId }`. No new row.
3. In `handleNextStep` (lines 203-218), change the toast on step 1:
   - First time (no prior `createdJobId` at start of call) → "Job created".
   - Subsequent times → "Job updated".
   Track this by checking `wizardState.createdJobId` before calling `submitStep1()`.
4. Same logic already protects `handleSaveAndExit` (line 224 guards on `!createdJobId` for the create path); leave as-is, but make sure if `createdJobId` exists it persists any pending edits via `updateJob` before closing. Add the same create-vs-update branch there for consistency.

No DB changes. No changes to step 2+ components. Button label on step 1 can stay "Create & continue" the first time and switch to "Save & continue" once `createdJobId` exists (minor polish in `getPrimaryAction`, line 343-349).

## Verification

- Open wizard → fill step 1 → Continue (job created, 1 row in `jobs`).
- Go back to step 1, change title, Continue again → same row updated, no duplicate. Confirm via `select count(*)` or by reloading Jobs list.
- Save & exit from step 1 after edits behaves the same (no duplicate).

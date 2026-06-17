## Diagnosis

When you click **Edit step 2** from the Summary, `JobWizard` simply sets `currentStep` back to 2 — `wizardState.jobData` is preserved, and DB-backed data (pipeline stages, team assignments, posting fields) is reloaded from the database. So the *core* data is not actually gone.

What **does** get wiped is the in-component UI state for steps 2 and 3, which today lives in plain `useState` hooks inside those step components. When you navigate away to the Summary, the step unmounts; when you come back via "Edit step X", it remounts and those `useState` values reset to their defaults — so it *looks* like everything was cleared.

Specifically, the following are lost on remount:

**Step 2 — Hiring plan** (`HiringPlanStep.tsx`)
- `selectedTemplate` — the highlighted template card (Workspace default / Lean tech / Exec)
- `rejectOutsideLocations`, `rejectSalaryAbove`, `rejectRepeatApplicant` — auto-rejection toggles
- `autoScore`, `autoRejectBelow`, `autoRejectThreshold`, `generateSummary` — AI auto-screen toggles

(The actual pipeline stages in `HiringPlanTab` are DB-backed and reload correctly, but the template card no longer shows as selected, which is the strongest "this was wiped" signal.)

**Step 3 — Hiring team** (`HiringTeamStep.tsx`)
- `reportsToId`, `coordinatorId`
- `notifyOnApplications`, `dailyDigest`, `notifyStageMoves`
- `memberSearch`

(Assignments themselves are DB-backed via `useJobAssignments` and reload correctly.)

Step 1 is fully controlled via `wizardState.jobData`, and Step 4 saves its posting on "Continue", so neither of those should lose data on remount — the user's report matches the Step 2/3 local-state pattern.

## Fix

Lift the local UI state of Steps 2 and 3 into `JobWizard`'s `wizardState`, then pass it down as controlled props. This is exactly the same pattern Step 1 already uses (`jobData` + `onUpdate`), and it survives unmount/remount because the parent never unmounts during step navigation.

### Changes

1. **`src/components/jobs/JobWizard.tsx`**
   - Extend `WizardState` with two new sub-objects:
     - `hiringPlanUi: { selectedTemplate, rejectOutsideLocations, rejectSalaryAbove, rejectRepeatApplicant, autoScore, autoRejectBelow, autoRejectThreshold, generateSummary }`
     - `hiringTeamUi: { reportsToId, coordinatorId, notifyOnApplications, dailyDigest, notifyStageMoves, memberSearch }`
   - Initialize them in `seedData`/`resetWizard` with the current defaults.
   - Add `updateHiringPlanUi` / `updateHiringTeamUi` helpers (shallow merge, same shape as `updateJobData`).
   - Pass `value` + `onChange` props into `<HiringPlanStep>` and `<HiringTeamStep>`.

2. **`src/components/jobs/wizard/HiringPlanStep.tsx`**
   - Replace the seven `useState` declarations listed above with controlled props from the parent.
   - Keep `applyingTemplate` and `planVersion` as local state (they're transient — in-flight save indicator and HiringPlanTab remount key — and don't represent user choices to preserve).

3. **`src/components/jobs/wizard/HiringTeamStep.tsx`**
   - Replace the six `useState` declarations listed above with controlled props from the parent.
   - `memberSearch` can stay local if we want the search box to clear on revisit; safer to lift it too for full consistency.

### Out of scope

- No DB schema changes. These fields are still "UI only, wired to backend in a follow-up" per the existing code comments — this plan just makes them survive in-session navigation, which is what the user reported.
- Resuming a draft from Jobs → Drafts after closing the wizard will still start these toggles at their defaults (unchanged behavior). If you want them to persist across sessions too, that's a separate follow-up that requires backend columns.

### Validation

- Open the wizard, fill Step 1, advance to Step 2, pick "Lean tech hire", flip a couple of auto-rejection toggles, advance through Steps 3, 4 to Summary.
- From Summary, click **Edit step 2** → template card should still be highlighted, toggles should still match what you set.
- Repeat for Step 3 (assign a member, change notification toggles, go to Summary, Edit step 3).

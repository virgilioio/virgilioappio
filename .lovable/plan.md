# Job wizard — Step 1 → 4 polish

Eight focused fixes across Steps 1–4 plus a small UX issue with the footer "Continue" button. Step 5 is out of scope for this round.

## 1. Step 1 (Job information) — remove the Compensation section
The whole `Compensation` block (Currency, Min/Max salary, "Show salary on public posting", "Include equity", "Include signing bonus") moves to Step 4. Step 1 keeps Basics, Location & Employment, Job description, Required skills. Wizard state still holds those fields — only the UI moves, so step-1 data already entered carries through.

## 2. Step 2 (Hiring plan) — make Template cards functional
Right now the three template cards (`workspace_default`, `lean_tech`, `exec_leadership`) only highlight on click. Wire them to actually configure the job's stages using existing infrastructure:

- Use `useJobStages()` to read the library and `useJobHiringPlan().saveHiringPlan(jobId, stages)` to write.
- Define a static map: template id → ordered list of `stage_type`s, e.g.
  - `workspace_default`: application_review → screening → assessment → interview → interview → offer
  - `lean_tech`: application_review → screening → interview → offer
  - `exec_leadership`: workspace_default + 2 extra leadership interview stages + reference_check
- On template click: resolve each `stage_type` to the first matching active stage in the library (prefer platform defaults, then tenant), call `saveHiringPlan`, then trigger a refresh of `HiringPlanTab`.
- Show a small toast on success and re-render the stages list. Card remains visually selected.
- If a required `stage_type` isn't present in the library, skip it silently and toast a friendly note ("Some stages weren't in your library and were skipped").

To refresh `HiringPlanTab` after the write, lift the trigger into a `key` prop bumped from `HiringPlanStep` after `saveHiringPlan` resolves.

## 3. Step 3 (Hiring team) — search bar above Team members
Add a slim `<TableSearch>`-style input (Gio dropdown chrome, 30h, max 280w) right of the section title or just below the header, filtering the `teamRows` list by name + email substring (case-insensitive).

## 4. Step 3 — fix "main recruiter" swap regression
Bug: `setOwner('recruiter', newId)` calls `removeUserFromJob(current.id)` then `assignUserToJob(...)`. When the new id was previously demoted (or already exists as a non-owner assignment), the insert collides with the unique (job, user, role) or RLS check, producing the toast.

Fix in `setOwner`:
1. If `newUserId` already has an assignment on this job (any role), call `updateAssignmentRole(existing.id, role)` instead of insert.
2. Only remove the previous owner if it's a different user.
3. Wrap in try/catch and surface a clearer toast.

Same logic applies to `hiring_manager`.

## 5. Step 4 — replace native date input with `DatePickerVirgilio`
`Application deadline` currently uses `<Input type="date">`. Swap for `<DatePickerVirgilio value onChange />` per the style guide. Convert state to `Date | undefined` and serialize to ISO date on save.

## 6. Step 4 — add Compensation section under Posting basics
New `SectionCard title="Compensation"` placed directly after Posting basics. Contents:

- Row 1: Currency (CurrencySelect), Min salary, Max salary — reuse `SalaryInput`, bind to `jobData.currency / salary_min / salary_max` via the same `onUpdate` path used in step 1 (pass `jobData` and `onUpdate` into `JobPostingStep` as new props).
- Toggles: "Show salary on public posting", "Include equity", "Include signing bonus" — same bindings.
- New: "Include variable / commission" toggle. When on, reveal two fields: Commission currency (CurrencySelect) + Commission amount (SalaryInput) with hint "On-target earnings or % — your call".
- Persist commission to `posting.details.compensation = { variable_enabled, commission_currency, commission_amount }` inside `savePosting()`.

Add `commission_*` keys to the saved `details` only; no DB migration needed (details is JSON).

## 7. Step 4 — wire Application form "Add question" to the smart-field library
Today the button appends a generic placeholder. Replace with a `<DropdownMenu>` (Gio chrome, `align="end"`) anchored to the "Add question" button, listing:

- Group "Smart fields" — items from `useApplicationFields()` (label + small type chip).
- Divider.
- Item "Custom question…" — keeps current behavior (push a new editable row).

Selecting a smart field appends an `AppField` derived from the library entry (id = library id, label, type mapped from `field_type`, icon based on type via a small switch). Already-added field ids are disabled in the menu.

Visual: follow `docs/style-guide.md` §5 dropdown spec (already enforced by `<DropdownMenu>` primitive + `menu-classes.ts`). No new component needed.

## 8. Footer "Continue" — scroll to top on step change
The main `<main>` scroll container in `JobWizard.tsx` keeps its scroll position when the step changes. Fix: in a `useEffect` keyed on `wizardState.currentStep`, scroll the main element to top (`mainRef.current?.scrollTo({ top: 0 })`). Add a ref to the `<main>` element.

## Files touched

- `src/components/jobs/JobWizard.tsx` — scroll-to-top effect, pass `jobData`+`onUpdate` to `JobPostingStep`.
- `src/components/jobs/wizard/JobInfoStep.tsx` — remove Compensation `SectionCard`.
- `src/components/jobs/wizard/HiringPlanStep.tsx` — template → stages wiring, bump child key on apply.
- `src/components/jobs/wizard/HiringTeamStep.tsx` — search input, fix `setOwner` collision logic.
- `src/components/jobs/wizard/JobPostingStep.tsx` — `DatePickerVirgilio`, Compensation section, smart-field dropdown for Add question, accept `jobData`+`onUpdate` props.

## Out of scope

- Step 5 (Summary) — next round.
- Backend schema changes (commission stored in existing `details` JSON).
- Wiring the other still-cosmetic toggles on Step 2 (AI auto-screen, auto-rejection rules) — separate task.

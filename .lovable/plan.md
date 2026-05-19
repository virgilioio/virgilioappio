# Job Wizard Step 3 — Hiring Team

Redesign only Step 3 of the Create/Edit Job wizard using the uploaded screenshots and `30c_Create_job_3_Hiring_team.html` reference.

## What will change

### 1. Step 3 page content
- Replace the current embedded `HiringTeamTab` with a custom wizard layout matching the reference.
- Keep the existing wizard shell: left rail, header, close control, scroll area, and sticky footer.
- Header copy:
  - `CREATE JOB · STEP 3 OF 4`
  - `Hiring team.`
  - `Who can see this job, and what they can do. Add as many people as needed; assign roles for what they'll do on this job specifically.`

### 2. Owners section
- Add an `OWNERS` card with:
  - Primary recruiter selector
  - Hiring manager selector
  - Reports to selector
  - Coordinator selector
- Use workspace members from the existing members data.
- Primary recruiter and hiring manager persist through existing `job_assignments` roles.

### 3. Team members section
- Add a `TEAM MEMBERS` card/list with:
  - Member checkbox
  - Avatar initials
  - Name and subtitle
  - Role selector
  - Permission summary text
  - Settings/sliders icon
- Use existing `useMembers(true)` and `useJobAssignments(jobId)` hooks.
- Checking/unchecking members creates/removes `job_assignments` rows.
- Role changes update the existing assignment role.

### 4. Roles on this job section
- Add the six role explanation tiles from the reference:
  - Recruiter
  - Hiring manager
  - Interviewer
  - Coordinator
  - Sourcer
  - Observer
- Show live counts where backed by current assignments.
- Extra roles not supported by the current DB enum remain visual/reference-only for this pass.

### 5. Notifications section
- Add three notification toggle rows matching the screenshot:
  - Notify owners on new applications
  - Daily digest at 9:00 AM
  - Notify hiring team when stage moves
- These are local UI state only for now unless we decide later to add backend persistence.

### 6. Footer behavior
- Enable the Step 3 sticky footer in `JobWizard.tsx`.
- Footer primary button becomes `Review & create` and advances to Step 4.
- Footer meta line shows assigned team counts like `4 members assigned · 1 recruiter · 1 HM · 2 panelists`.

## Files to edit
- `src/components/jobs/wizard/HiringTeamStep.tsx`
- `src/components/jobs/wizard/_parts.tsx`
- `src/components/jobs/JobWizard.tsx`

## Out of scope
- Step 4 Summary.
- Database enum expansion for Coordinator/Sourcer/Observer.
- Persistent notification settings.

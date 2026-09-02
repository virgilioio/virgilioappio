# Make the Owners card pickers work

## What's wrong today

In Job → Setup → Hiring team → Owners:

- **Reports to** and **Coordinator** are decorative. In `JobSetupLayout.tsx` they render `OptionalOwnerField`, a plain `<button>` with a chevron and hardcoded placeholder text — no state, no menu, no click handler. That's why nothing opens.
- **Primary recruiter** and **Hiring manager** do open a searchable member popover, but choosing someone only fires a "Coming soon" toast (`updatePrimary`) — the assignment is never changed.
- There is no storage anywhere for "reports to" or "coordinator": the `jobs` table has no such columns and `job_assignment_role` only has `recruiter`, `hiring_manager`, `interviewer`. The job wizard keeps both in local UI state only.

## What we'll build

### 1. Storage for the two optional owners

Add two nullable columns to `jobs`:

- `reports_to_user_id` (uuid, nullable)
- `coordinator_user_id` (uuid, nullable)

No new table, no RLS changes — existing job policies already govern reads/writes on `jobs`.

### 2. Two real pickers

Replace `OptionalOwnerField` with a working picker that reuses the exact chrome and behavior of the existing `OwnerPickerRow` (Popover + Command searchable list of active workspace members, avatar, name, email, check on the selected one), kept in the compact 44px field style so the card's look doesn't change.

Each picker:

- opens on click, searches members, selects a person, shows their name in the field
- writes the chosen user id to the matching `jobs` column and refreshes
- offers a "Clear" / "Same as recruiter" (Coordinator) option to unset it back to null
- is disabled and non-clickable for read-only viewers

### 3. Primary recruiter / hiring manager actually reassign

`updatePrimary` gets real behavior against `job_assignments`:

- if the newly picked person already has an assignment on this job, promote that row's role
- otherwise create the assignment with that role
- the previous holder of the role is demoted to `interviewer` rather than deleted, so nobody silently loses access
- refresh the assignment list so the Owners card and the Team members list agree

## Guardrails

- Per-job role model stays `recruiter` / `hiring_manager` / `interviewer` — no new enum values.
- No change to team-member add/remove, seat logic, permissions, or any other section of the Setup page.
- Card layout, typography and spacing stay as they are; only the two dead fields become interactive.

## Technical notes

- `src/components/jobs/JobSetupLayout.tsx`: delete `OptionalOwnerField`, add a `CompactOwnerPicker` (Popover + Command, `members` list, `value`, `onChange`, `onClear`, `disabled`); wire both instances to job-level state.
- New hook (or a small mutation inside the panel) to `update jobs set reports_to_user_id / coordinator_user_id` by job id, invalidating the job query so the value survives reload.
- `updatePrimary` uses `useJobAssignments`'s `assignUserToJob` / `updateAssignmentRole` (both already exported) instead of the placeholder toast.

## Verification

- Click Reports to → menu opens, search works, pick a member → name shows; reload the page → still there.
- Coordinator → same, plus "Same as recruiter" clears it back to the default hint.
- Change Primary recruiter → the picked person appears as recruiter in Owners and in Team members; the old recruiter shows as Interviewer.
- Read-only viewer: all four fields inert.

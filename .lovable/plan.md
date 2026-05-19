# Fix: Panelist autocomplete shows no teammates

## Root cause

`PanelistComboField` is fed only by `availableInterviewers`, which is built from `stage_interviewer_assignments` for the current stage. On this job/stage the stage has no configured interviewers with active `booking_configurations`, so the source list is empty and typing a name can never match anything — the dropdown correctly says "No teammates match" because no candidates exist to filter.

What the user expects: typing a name searches the **job's hiring team** (everyone assigned to the job), not just whoever was pre-configured on the stage. Picking a hiring-team member who has no booking config should still surface them, but as unavailable (shown under "No calendar connected").

## Fix

Broaden the source of teammates the field searches, while keeping today's "calendar required to actually schedule" guarantee.

1. Add a second query inside `ScheduleInterviewSheet` that fetches the job's assignees (`job_assignments` → `members` → `profiles` + `booking_configurations`) for the current job.
2. Merge stage interviewers + job hiring team into a single deduped pool keyed by `member_id`. Stage assignments keep their `assignment_type` (required/optional/manual); hiring-team-only entries default to `assignment_type: 'manual'`.
3. Recompute `availableInterviewers` and `interviewersWithoutBookingConfig` from the merged pool:
   - Available = has active `booking_configurations`.
   - Unavailable ("No calendar connected") = no active booking config — still listed in the dropdown as disabled with the "No calendar" hint, so the recruiter can see they exist.
4. Sort: stage `required` → stage `optional` → hiring-team `manual`, then alphabetical.
5. No change to selection model (still single-select via `setSelectedInterviewer`) or to the existing scheduling logic — only the candidate pool grows.

## Files

- `src/components/candidates/ScheduleInterviewSheet.tsx` — add hiring-team query, merge logic, and adjust the two memos that feed `PanelistComboField`.

## Out of scope

- Multi-panelist selection (today's state is single-select; chip removal already supported by the field).
- Any changes to `stage_interviewer_assignments`, booking config, or RLS.
- Changes to group mode (`scheduling_mode === 'all'`).

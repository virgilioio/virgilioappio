# Panelist field: source pool + pre-population

Three connected fixes to the "Schedule interview" sheet's interviewer field.

## 1. Stage-assigned interviewer not pre-populated

Today the sheet only auto-fills `selectedInterviewer` when there is exactly one *available* interviewer (i.e. with an active `booking_configurations`). If the recruiter just assigned someone to the stage but that person hasn't connected a calendar yet, nothing pre-fills, so it looks like the assignment was ignored.

Fix: when the sheet opens, pre-populate `selectedInterviewer` with the first stage-assigned interviewer (required → optional → manual), regardless of calendar status. If they have no calendar, show an inline hint next to their chip ("No calendar connected — connect Google to schedule") and disable the slot grid until a schedulable panelist is chosen. The recruiter can still remove the chip and pick someone else from the dropdown.

## 2. Source pool falls back to job hiring team

When the stage has no `stage_interviewer_assignments`, the dropdown is empty. Broaden the pool:

- Primary source: stage interviewers (`stage_interviewer_assignments` for `jhsId`).
- Fallback when stage has none configured: every `job_assignments` member for the current job.
- Merge & dedupe by `member_id`. Stage assignments keep their `assignment_type`; hiring-team-only entries default to `manual`.
- "Available" = active booking config (selectable, used for slot calculation).
- "No calendar connected" = present in the pool, shown as disabled in the dropdown so the recruiter sees they exist.

## 3. Open question — workspace-wide "Other teammates"

In the previous turn I proposed an optional third tier that searches *any* teammate in the workspace (e.g. a bar-raiser from another team). Default plan: **not included**. Confirm if you want it added.

## Implementation

- `src/components/candidates/ScheduleInterviewSheet.tsx`
  - Add a `job-hiring-team-for-scheduling` query (joins `job_assignments` → `members` → `profiles` + `booking_configurations` for the active `jobId`).
  - Merge stage + hiring-team rows, dedupe by `member_id`, recompute `availableInterviewers` and `interviewersWithoutBookingConfig` from the merged pool.
  - Replace the auto-select effect: on first open, pick the first stage-assigned interviewer if any (available or not), else leave empty.
  - Disable the slot grid and CTA when the selected panelist has no active calendar; show a one-line warning under the chip.

No backend, schema, or RLS changes. No edits to group mode (`scheduling_mode === 'all'`) or to the calendar/slot logic. Cache invalidation already exists (`['stage-interviewers', jhsId]` is invalidated by `useStageInterviewerAssignments`), so freshly-assigned interviewers will flow in once this is wired.

## Out of scope

- Multi-panelist selection in non-group mode.
- Adding/inviting external email addresses (people not in the workspace at all).
- Any changes to `stage_interviewer_assignments` or booking config tables.

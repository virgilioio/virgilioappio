# Allow more interviewers in the Schedule sheet

## Today

The "+Add panelist" dropdown is populated from `stage_interviewer_assignments` only. In non-group mode the field is also limited to a single selection (`selectedInterviewer`), so even if more options existed the recruiter could only pick one.

## What changes

1. **Source pool = stage interviewers + job hiring team**, deduped by `member_id`. Stage assignments keep their `assignment_type` (required → optional → manual); hiring-team-only entries default to `manual`. Sort: required → optional → manual → alphabetical.
2. **Available** = entries with an active `booking_configurations` (selectable, used for slot calculation).
3. **No calendar connected** = entries without an active booking config — still shown as disabled in the dropdown so the recruiter knows they exist.
4. **Selection model stays single** for this iteration. Adding multi-panelist (in non-group mode) requires changing the slot-availability query (`useStageBookingInterviewers`) to compute intersection of multiple calendars, plus updating the booking write path — that's a separate, larger change.

## Confirm scope

- (a) Ship the expanded source pool now with single selection — pick any one teammate, not just stage-assigned. *(default)*
- (b) Also expand selection to multi-panelist in non-group mode, accepting the slot/booking changes that brings.

If (a) is fine, I'll implement it as described. If (b), I'll come back with a tighter sub-plan for the slot-intersection logic before touching it.

## Implementation (option a)

`src/components/candidates/ScheduleInterviewSheet.tsx`
- Add a `job-hiring-team-for-scheduling` query (joins `job_assignments` → `members` → `profiles` + `booking_configurations` for the active `jobId`).
- Merge stage + hiring-team rows by `member_id`; recompute `availableInterviewers` and `interviewersWithoutBookingConfig` from the merged pool.
- Keep the existing auto-select-when-exactly-one rule, since pre-configured stage interviewers must still appear pre-filled.
- No other UI, schema, RLS, or booking-logic changes.

## Out of scope

- External email invites (people outside the workspace).
- Workspace-wide "Other teammates" tier.
- Group mode (`scheduling_mode === 'all'`).

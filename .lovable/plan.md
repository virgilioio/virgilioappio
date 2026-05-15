# Hiring team display + Job posts card

## 1. Hiring team card shows nothing
The card reads `job.hiring_team` (legacy JSONB), but real assignments live in `job_assignments` (one row per user+role) — that's why the Memberships Campaign Manager job is empty even though it has assignees in the dialog.

**Fix in `JobSetupLayout.tsx`:**
- Drop the `team` prop derived from `job.hiring_team`.
- Use `useJobAssignments(jobId)` + `useMembers(true)` (same pattern as `JobAssignmentsPanel`) to build the displayed list.
- For each assignment, show: avatar (initials fallback), `First Last`, role label (`Recruiter (owner)` if creator, `Hiring manager`, `Interviewer`).
- Empty state copy: "No team members yet." with a subtle "Add" CTA opening the existing `HiringTeamManageDialog`.
- Mock-up parity: stack rows tightly (8px gap), 32px avatars, name in `text-body-sm` medium, role in `text-body-xs` secondary. Match the screenshot.

No backend / RLS changes — `useJobAssignments` already works in the dialog.

## 2. New "Job posts" card under Hiring team
Add a third card to the right rail of `JobSetupLayout`, below "Hiring team":

- Title: "Job posts" + "Add" ghost button on the right (admin only).
- Body: list each posting from `useJobPostings(jobId)` as a compact row:
  - Title + slug (mono, 11px)
  - Status badge: `green` Active / `neutral` Inactive
  - Row click → opens edit; Add → opens create.
- Empty state: "No job posts yet." + "Create posting" ghost button.
- Reuse the existing `<PostingSheet>` for create/edit (already used by `JobPostingsTab`).

No new hooks, no schema changes.

## Files
- Edit: `src/components/jobs/JobSetupLayout.tsx`
  - Add `useJobAssignments` + `useMembers` lookup → render assignments in Hiring team card.
  - Add Job posts card using `useJobPostings` + `PostingSheet`.
- No changes to `JobDetail.tsx` (existing `onAddTeamMember` wiring stays).

## Out of scope
- Touching `job.hiring_team` JSONB column or migrations.
- Restyling `JobAssignmentsPanel` / `PostingSheet`.
- Pipeline / Job Dashboard tabs.

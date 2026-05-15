# Add hiring team members from Setup tab

## Problem
The Setup tab has a "Hiring team" card with an "+ Add" button slot (`onAddTeamMember`), but `JobDetail.tsx` never passes the handler in — so the button never renders and there's no way to add members from Setup. The full management UI (`JobAssignmentsPanel`) only lives in the legacy `HiringTeamTab`, which isn't surfaced anywhere in the new Setup layout.

## Goal
From `Job → Setup → Hiring team` card, the user can:
1. See current members (already works).
2. Click "+ Add" to invite/assign a teammate to this job with a role (Recruiter, Hiring Manager, Interviewer, etc.) — using the existing assignment system.
3. Optionally manage / remove existing assignments.

## Approach (UI-only, reuses existing logic)

1. **Create `HiringTeamManageDialog`** (`src/components/jobs/HiringTeamManageDialog.tsx`)
   - Standard `Dialog` styled per design system (rounded-2xl, shadow-sm, max-w-2xl).
   - Header: "Manage hiring team — {jobTitle}".
   - Body: render the existing `<JobAssignmentsPanel jobId jobTitle />` — it already handles add / role-change / remove with the proper Select + member picker.
   - Footer: single "Done" close button.

2. **Wire it in `JobDetail.tsx`**
   - Add `const [teamDialogOpen, setTeamDialogOpen] = useState(false)`.
   - Pass `onAddTeamMember={() => setTeamDialogOpen(true)}` into `<JobSetupLayout>`.
   - Render `<HiringTeamManageDialog open={teamDialogOpen} onOpenChange={setTeamDialogOpen} jobId={id!} jobTitle={job.title} />` near the other dialogs.

3. **No changes** to `JobSetupLayout.tsx` — the card already conditionally shows the Add button when `onAddTeamMember` is provided and the user is not read-only.

## Out of scope
- Schema / RLS / backend changes.
- Restyling `JobAssignmentsPanel` itself.
- Removing the legacy `HiringTeamTab` route.

## Files
- New: `src/components/jobs/HiringTeamManageDialog.tsx`
- Edit: `src/pages/JobDetail.tsx` (wire dialog + handler)

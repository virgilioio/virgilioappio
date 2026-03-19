

# Inline Job Assignment Management in Member Detail Sheet

## Overview
Add the ability to change a member's role on a job assignment and remove assignments directly from the Member Detail Sheet, without needing a separate dialog.

## Changes

### 1. Add inline actions to each job assignment row
**File: `src/components/members/MemberDetailSheet.tsx`**
- Add a **role dropdown** (Select) on each job row allowing switching between `recruiter`, `hiring_manager`, `interviewer`
- Add a **remove button** (X / Trash icon) on each job row to delete the assignment
- Add a **"Manage Jobs"** button in the Job Assignments header to open the existing `MemberJobAssignmentsDialog` for adding new assignments
- Import `useQueryClient` to invalidate `member-job-assignments` after mutations
- Import and use `supabase` directly for update/delete operations (keeps it simple)

### 2. Mutation logic (inline in the component)
- **Change role**: `supabase.from('job_assignments').update({ role }).eq('id', assignmentId)` → invalidate query → show toast
- **Remove assignment**: `supabase.from('job_assignments').delete().eq('id', assignmentId)` → invalidate query → show toast → also call `update-seat-quantity` edge function (since removing a recruiter assignment may change billing)

### 3. Update `JobGroup` component
- Refactor `JobGroup` to accept `onRoleChange(assignmentId, newRole)` and `onRemove(assignmentId)` callbacks
- Each job row gets:
  - A small `Select` dropdown (role switcher) replacing the static status badge
  - A subtle trash/X icon button on hover for removal
  - Confirmation via a simple `AlertDialog` before removing

### 4. Wire up the MemberJobAssignmentsDialog
- Add a "Manage Jobs" button that opens the existing `MemberJobAssignmentsDialog` for bulk add/remove
- After dialog closes, invalidate `member-job-assignments` query to refresh the sheet

## Files to Edit
| File | Action |
|------|--------|
| `src/components/members/MemberDetailSheet.tsx` | Add role dropdown, remove button, manage jobs button |

No new files needed — reuses existing `MemberJobAssignmentsDialog` and direct Supabase calls.


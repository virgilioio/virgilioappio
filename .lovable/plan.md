

# Billing Confirmation Dialog for Recruiter Assignments

## Context
In platforms like Greenhouse and Ashby, assigning a user as a recruiter (a billable role) triggers a confirmation step warning the admin that this will add a paid seat. This prevents accidental billing changes.

Currently, the app has three surfaces where a user can be assigned as a recruiter:
1. **JobAssignmentsPanel** — role selector when assigning a user to a job
2. **MemberJobAssignmentsDialog** — bulk toggle of job access from members page
3. **MemberDetailSheet** — inline role dropdown on existing assignments

None of these warn the admin when the action will convert a free user into a paid seat.

## Approach
Create a reusable **`SeatUpgradeConfirmDialog`** component that intercepts recruiter assignments for users who are currently on a free seat.

## Changes

### 1. New component: `SeatUpgradeConfirmDialog`
**File: `src/components/billing/SeatUpgradeConfirmDialog.tsx`**
- AlertDialog with clear messaging: "Assigning [Name] as a Recruiter will convert them from a free collaborator to a paid seat."
- Shows current paid seat count and the new count after confirmation
- Uses `useStripePricing` to display the per-seat cost impact (e.g., "+$XX/mo")
- Props: `open`, `onConfirm`, `onCancel`, `memberName`, `currentPaidSeats`

### 2. Integrate into `JobAssignmentsPanel`
**File: `src/components/jobs/JobAssignmentsPanel.tsx`**
- When "Assign User" is clicked with role = `recruiter`, check if the selected user is currently a free seat (not admin, has no existing recruiter assignments via `useRecruiterUserIds`)
- If free → show `SeatUpgradeConfirmDialog` before proceeding
- If already paid → assign directly

### 3. Integrate into `MemberJobAssignmentsDialog`
**File: `src/components/members/MemberJobAssignmentsDialog.tsx`**
- On "Save Changes", if the member is currently free (system_role = `member`, not in `recruiterUserIds`) and new assignments are being added (default role is recruiter), show the confirmation dialog
- Only triggers when it's their **first** job assignment (which defaults to recruiter role)

### 4. Integrate into `MemberDetailSheet`
**File: `src/components/members/MemberDetailSheet.tsx`**
- When changing an assignment's role **to** `recruiter` via the inline dropdown, check if the user currently has no other recruiter assignments
- If this would be their first recruiter role → show confirmation dialog
- If they already have recruiter on another job → change directly (already paid)

### 5. Integrate into `JobAssignmentsPanel` role change
**File: `src/components/jobs/JobAssignmentsPanel.tsx`**
- Same logic for the role change dropdown on existing assignments

## Detection Logic
A user is "currently free" when:
- `system_role === 'member'` (not admin/owner)
- They have zero recruiter assignments (not in `recruiterUserIds` set)

Assigning them as recruiter on any job converts them to a paid seat.

## Files Summary
| File | Action |
|------|--------|
| `src/components/billing/SeatUpgradeConfirmDialog.tsx` | New — reusable confirmation dialog |
| `src/components/jobs/JobAssignmentsPanel.tsx` | Add confirmation before recruiter assign/role-change |
| `src/components/members/MemberJobAssignmentsDialog.tsx` | Add confirmation on save when free user gets first assignment |
| `src/components/members/MemberDetailSheet.tsx` | Add confirmation on inline role change to recruiter |


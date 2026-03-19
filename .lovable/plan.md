

# Redesign Members View for Seat Clarity

## Problem
The current view splits members into two tabs (Paid Seats / Collaborators) but within each tab, the "Role" column only shows `system_role` (Admin/Member). There's no indication of **why** someone is a paid seat — a member with `system_role: member` who is a Recruiter on a job appears as "Member" with no distinction from a Hiring Manager.

## How Big ATS Platforms Handle This

Greenhouse, Ashby, and Lever typically use a **single unified list** with:
- A **"Seat Type"** or **"License"** badge per row (e.g., `Paid` / `Free`) 
- A **descriptive role label** showing the effective role: `Admin`, `Recruiter`, `Hiring Manager`, `Interviewer`, `Collaborator`
- **Filters** to narrow by seat type and role
- No tab splitting — one table, filterable

## Proposed Changes

### 1. Remove Tabs, Use Single Table with Seat Badge
Replace the Paid Seats / Collaborators tabs with one unified `MembersTable`. Add a **"Seat"** column showing a colored badge:
- **Paid** (purple badge) — for admins, workspace owners, and recruiters
- **Free** (green/neutral badge) — for everyone else

### 2. Show Effective Role Instead of System Role
Replace the current "Role" column (which just shows `admin`/`member`) with an **effective role** that explains *why* they're billable:
- `Admin` — system_role is admin
- `Owner` — user_type is workspace_owner
- `Recruiter` — user_id is in recruiterUserIds (assigned as recruiter on at least one job)
- `Hiring Manager` — system_role is member, not a recruiter (future: check job_assignments for HM role)
- `Member` — fallback for members with no job assignments

### 3. Add Seat Type Filter
Add a new filter dropdown in the MembersTable toolbar: `All Seats` / `Paid` / `Free`, alongside the existing role and status filters.

### 4. Pass Effective Role Data to Table
`MembersTab.tsx` will compute an `effectiveRole` and `seatType` for each member before passing to `MembersTable`. This keeps the table component presentation-only.

## Files to Edit

**`src/components/settings/MembersTab.tsx`**
- Remove `Tabs`/`TabsList`/`TabsTrigger`/`TabsContent` wrapper
- Enrich each member with `effectiveRole` and `seatType` before passing to a single `MembersTable`
- Keep the stat cards (Paid Seats count, Collaborators count) above the table

**`src/components/members/MembersTable.tsx`**
- Add a "Seat" column with `Paid`/`Free` badge
- Replace the "Role" column to show `effectiveRole` instead of raw `system_role`
- Add a seat type filter dropdown (`All` / `Paid` / `Free`)
- Update role filter options to include effective roles (Admin, Recruiter, Hiring Manager, etc.)

**`src/hooks/useMembers.ts`** — No changes needed (Member type already has `system_role` and `user_type`)


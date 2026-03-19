

# Team Members Table UI Overhaul

## Overview
Six improvements to the Team Members table: row selection checkboxes, circular avatars, combined name+email column, formalized role badge system, creative role-specific badge colors, and a new Member Detail Sheet showing recruiter job assignments.

## Changes

### 1. Add Row Selection (Checkbox column)
**File: `src/components/members/MembersTable.tsx`**
- Add `useState` for `selectedIds: string[]` and `selectionMode` toggle
- Add a checkbox column (first column) matching the pattern from `CandidateTable.tsx`
- Header checkbox for select-all on current filtered list
- Row-level checkboxes with `stopPropagation`
- Add a selection toolbar (floating bar or top bar) showing "X selected" with bulk action options (deactivate, delete)

### 2. Add Circular Avatars to Each Row
**File: `src/components/members/MembersTable.tsx`**
- Import `Avatar`, `AvatarFallback` from `@/components/ui/avatar`
- In the Name cell, prepend a small avatar (h-8 w-8) with initials fallback derived from first/last name
- Use the brand purple as the avatar fallback background for visual consistency

### 3. Combine Name + Email into One Column
**File: `src/components/members/MembersTable.tsx`**
- Remove the separate "Email" column
- In the "Name" column cell, render:
  - Avatar + Name (bold) on top
  - Email (text-sm text-muted-foreground) below the name
  - For invited users, append "(pending)" to email with italic styling
- Remove `<TableHead>Email</TableHead>` and update `colSpan` for empty state

### 4 & 5. Formalize Role Badge System with Creative Colors
**File: `src/components/ui/badge.tsx`**
Add new role-specific badge variants to `badgeVariants`:
- `role-recruiter`: Purple background (brand purple) — `bg-primary/15 text-primary border-primary/20`
- `role-admin`: Blue — `bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300`
- `role-owner`: Blue (same as admin, distinguished by label)
- `role-hiring-manager`: Orange — `bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300`
- `role-interviewer`: Light blue/cyan — `bg-cyan-100 text-cyan-700 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300`
- `seat-paid`: Purple tint — `bg-primary/10 text-primary border-primary/20`
- `seat-free`: Green tint — `bg-emerald-100 text-emerald-700 border-emerald-200`
- `status-active`: Green
- `status-invited`: Amber/warning
- `status-inactive`: Gray/muted

**File: `src/components/members/MembersTable.tsx`**
- Replace inline `className` badge styling with proper `variant` props
- Use `variant="role-recruiter"`, `variant="role-admin"`, etc.

**File: `src/components/settings/styleguide/BadgeGuide.tsx`**
- Add a new "Role Badges" section showcasing all role variants
- Add a "Seat & Status Badges" section showing seat-paid, seat-free, status-active, etc.
- Demonstrate usage context: "Team Members roles" example

### 6. Member Detail Sheet (with Recruiter Job Assignments)
**New file: `src/components/members/MemberDetailSheet.tsx`**
- A `Sheet` component (side panel) that opens when clicking a member row
- Header: Avatar (large, h-16 w-16), name, email, role badge, seat badge, status badge
- Sections:
  - **Member Info**: Name, email, role, seat type, status, joined date
  - **Job Assignments** (for recruiters): Query `job_assignments` table where `user_id = member.user_id` and `role = 'recruiter'`, join with `jobs` to show job title. Display as a list of job cards/links.
  - For non-recruiters, show a simpler "No job assignments" or list hiring manager assignments if applicable.

**New hook: `src/hooks/useMemberJobAssignments.ts`**
- Query `job_assignments` for a given `user_id`, join with `jobs` table to get job titles
- Filter by `deleted_at IS NULL`
- Return assignments grouped by role

**File: `src/components/members/MembersTable.tsx`**
- Make rows clickable (onClick opens the detail sheet)
- Add state for `selectedMember` to control sheet open/close

**File: `src/components/settings/MembersTab.tsx`**
- Pass the sheet state management or let `MembersTable` handle it internally

## Updated EnrichedMember Type
Add `'Interviewer'` to the `effectiveRole` union type to support the new badge variant.

## Summary of Files
| File | Action |
|------|--------|
| `src/components/ui/badge.tsx` | Add role/seat/status variants |
| `src/components/members/MembersTable.tsx` | Major refactor: checkboxes, avatars, combined column, new badges, row click |
| `src/components/members/MemberDetailSheet.tsx` | New — sliding panel with member details + job assignments |
| `src/hooks/useMemberJobAssignments.ts` | New — fetch job assignments for a member |
| `src/components/settings/styleguide/BadgeGuide.tsx` | Add role/seat/status badge sections |
| `src/components/settings/MembersTab.tsx` | Minor — pass through any needed props |


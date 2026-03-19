

# Standardize Filters: Departments & Members Tables → Chipped Filter Style

## Problem

The **Departments** (`OrganizationsTable`) and **Workspace Members** (`MembersTable`) pages use old-style `<Select>` dropdowns for filtering. The rest of the app (Candidates, Jobs, Pipeline, Analytics, Intelligence) uses the unified toolbar with `FilterChipPopover` chips. These two tables need to match.

## Changes

### 1. `src/components/organizations/OrganizationsTable.tsx`

Replace the `<Select>` status dropdown with the unified toolbar pattern:
- Compact search input (left-aligned, with Search icon) — already exists, just tighten styling to match (`h-9 w-[200px]`)
- `FilterChipPopover` for **Status** with options: Active, Inactive, All (with counts derived from `organizations` array)
- Wrap search + chip in a `flex flex-wrap items-center gap-2` row, with "Add Department" button right-aligned
- Add inline "Clear filters" text button when filters are active
- Remove the `<Select>` and `<SelectTrigger>` imports

### 2. `src/components/members/MembersTable.tsx`

Replace the three `<Select>` dropdowns (Seat, Role, Status) with `FilterChipPopover` chips:
- Compact search input (left, `h-9 w-[200px]`)
- `FilterChipPopover` for **Seat Type** — options: Paid, Free (with counts)
- `FilterChipPopover` for **Role** — options: Owner, Admin, Recruiter, Hiring Manager (with counts)
- `FilterChipPopover` for **Status** — options: active, invited, inactive (with counts)
- Wrap all in unified `flex flex-wrap items-center gap-2` toolbar row
- "Clear filters" inline text button when active
- "Add Member" button right-aligned
- Remove `Select` imports, adapt state from single-string to string-array to support multi-select chips

**State migration**: Current filters use single string values (`roleFilter: 'all'`). `FilterChipPopover` uses `string[]`. Change filter state to arrays and update the `filteredMembers` logic to check `arr.length === 0 || arr.includes(value)`.

### Files Summary

| File | Action |
|------|--------|
| `src/components/organizations/OrganizationsTable.tsx` | Replace Select with FilterChipPopover for status |
| `src/components/members/MembersTable.tsx` | Replace 3 Selects with 3 FilterChipPopovers, migrate filter state to arrays |


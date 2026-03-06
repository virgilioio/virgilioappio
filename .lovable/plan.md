

# Add Search, Filters & Controls to Members Table

## Changes to `src/components/members/MembersTable.tsx`

Add a toolbar between the CardHeader and the table with:

### 1. Search Bar
- Text input filtering by name and email (client-side, since data is already loaded)
- Debounced via `useMemo` on the filtered list

### 2. Filter Dropdowns
- **Role filter**: All / Admin / Member
- **Status filter**: All / Active / Invited / Inactive

### 3. Result Count
- Show `"Showing X of Y members"` below the toolbar

### Implementation

- Add `searchTerm`, `roleFilter`, `statusFilter` state variables
- Derive `filteredMembers` via `useMemo` that chains search + role + status filters over the `members` prop
- Render the toolbar row using existing `Input` component (with Search icon) and `Select` components from the UI library
- Replace `members.map(...)` with `filteredMembers.map(...)`
- Add a clear-filters button when any filter is active

Single file change: `src/components/members/MembersTable.tsx`


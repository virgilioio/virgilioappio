

# Find Page Layout: Unified Sidebar with Saved Searches + Vertical Filters

## New Layout

```text
┌────────────────────────┬──────────────────────────────────────────┐
│  SIDEBAR (w-80)        │  Header: Project Name + Status           │
│                        │  Tabs: Chat | Candidates | Saved | Arch  │
│  ┌──────────────────┐  │  ┌──────────────────────────────────────┐│
│  │ Saved Searches   │  │  │                                      ││
│  │ (popover/list    │  │  │  Candidate Table (full width)        ││
│  │  like SavedView) │  │  │                                      ││
│  └──────────────────┘  │  └──────────────────────────────────────┘│
│                        │                                          │
│  Search Criteria       │                                          │
│  ─────────────────     │                                          │
│  Job Titles:           │                                          │
│  [badge] [badge]       │                                          │
│  Keywords:             │                                          │
│  [badge] [badge]       │                                          │
│  Locations:            │                                          │
│  [badge]               │                                          │
│  ... (vertically)      │                                          │
│  [Edit] [Save&Refresh] │                                          │
│                        │                                          │
│  ─────────────────     │                                          │
│  Result Filters        │                                          │
│  ☐ Has Email           │                                          │
│  ☐ Has Phone           │                                          │
│  [Reset]               │                                          │
│                        │                                          │
│  [Collapse]            │                                          │
└────────────────────────┴──────────────────────────────────────────┘
```

The sidebar stays but is **repurposed** into one panel with two sections:
1. **Saved Searches** at the top — styled like the `SavedViewSelector` popover pattern (project list with search, status tabs, new search button, three-dot menus)
2. **Search Criteria + Result Filters** below — same content as current `SourcingFiltersPanel` but **without the cards/rounded containers** — just clean vertical labels + badge chips

## Changes

### 1. Refactor `SourcingSidebar.tsx` → unified sidebar

Keep the Sidebar component but restructure its content into two sections:

**Top section — Saved Searches:**
- Keep the search input, status tabs (Active/Archived/All), and project list exactly as they are now
- Add a collapsible section header "Saved Searches" so this section can be collapsed to give more room to filters
- Keep the "New Search" button

**Bottom section — Search & Filters (moved from `SourcingFiltersPanel`):**
- Move ALL filter content from `SourcingFiltersPanel` into this sidebar
- **Remove the card containers** (`rounded-xl bg-gradient-to-b ... border ... shadow-sm`) — render filter groups directly as vertical label + badges
- Keep the read-only/edit toggle for search criteria
- Keep the result filters (Has Email, Has Phone checkboxes)
- Keep Edit/Save & Refresh/Cancel/Reset buttons

New props needed: `project`, `filters`, `onFiltersChange`, `onUpdateSearchCriteria`, `isRefreshing` (passed down from `SourcingProjectView`)

### 2. Update `CandidatesTab.tsx`

- Remove `SourcingFiltersPanel` — filters are now in the sidebar
- Render only the `SourcingCandidateTable` at full width
- Remove filter-related props (`filters`, `onFiltersChange`, `onUpdateSearchCriteria`, `isRefreshing`) — these move to the sidebar

### 3. Update `SourcingProjectView.tsx`

- Pass filter props (`project`, `filters`, `onFiltersChange`, `onUpdateSearchCriteria`, `isRefreshing`) up to the parent `Find.tsx` so they can reach the sidebar
- Alternatively, expose them via a callback/context pattern

### 4. Update `Find.tsx`

- Keep `SidebarProvider` (sidebar is NOT being removed, just repurposed)
- Pass the filter and project props to the refactored `SourcingSidebar`
- The sidebar now shows Saved Searches + Filters when a project is selected, and just Saved Searches + New Search prompt when no project is selected

### 5. Delete `SourcingFiltersPanel.tsx`

Redundant — its content moves into the sidebar.

## Prop Flow

```text
Find.tsx
├── SourcingSidebar (project list + filters)
│   props: selectedProjectId, onSelectProject, onNewSearch,
│          project?, filters?, onFiltersChange?, onUpdateSearchCriteria?, isRefreshing?
└── SourcingProjectView
    └── CandidatesTab (table only, no filter panel)
```

The challenge: `filters` state and `project` data live in `SourcingProjectView`. Two options:
- **Option A**: Lift filter state to `Find.tsx` — cleanest, since both sidebar and project view need it
- **Option B**: Pass filters via context — more complex, not needed here

**Going with Option A**: Lift `filters`, `isRefreshing`, and `onUpdateSearchCriteria` to `Find.tsx`. `SourcingProjectView` continues to own project data but exposes what the sidebar needs via the existing `useSourcingProject` hook (which `Find.tsx` can also call since it has `projectId`).

## Files Summary

| File | Action |
|------|--------|
| `src/components/sourcing/SourcingSidebar.tsx` | Refactor — add filter sections below project list, remove cards |
| `src/components/sourcing/CandidatesTab.tsx` | Simplify — table only, remove filter panel |
| `src/components/sourcing/SourcingProjectView.tsx` | Remove filter panel props from CandidatesTab, expose filter state upward |
| `src/pages/Find.tsx` | Pass filter + project props to sidebar |
| `src/components/sourcing/SourcingFiltersPanel.tsx` | Delete |


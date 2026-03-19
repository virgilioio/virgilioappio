

# Redesign Find Page: Standard Layout + Real-Time Apollo Search

## New Layout

```text
┌─────────────────────────────────────────────────────────────┐
│  PageHeader: "Find."                                        │
├──────────────┬──────────────────────────────────────────────┤
│  FILTER PANEL│  Saved Searches selector (dropdown/popover)  │
│  (fixed left │  Tabs: Chat | Candidates | Saved | Archived  │
│   w-72,      │  ┌──────────────────────────────────────────┐│
│   scrollable)│  │                                          ││
│              │  │  Candidate Table (full width)            ││
│  ▼ Job Titles│  │                                          ││
│  ▼ Keywords  │  └──────────────────────────────────────────┘│
│  ▼ Locations │                                              │
│  ▼ Seniority │                                              │
│  ▼ Comp Size │                                              │
│  ▼ Industry  │                                              │
│  ▼ Companies │                                              │
│  ▼ Experience│                                              │
│  ─────────── │                                              │
│  ▼ Has Email │                                              │
│  ▼ Has Phone │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

- **No Shadcn Sidebar** — replace with a plain `div` (fixed width, non-collapsible, no overlay)
- Standard `PageHeader` with "Find" title at the top, like Jobs/Candidates pages
- Filter panel is a scrollable left column, always visible (even without a project selected — just empty/disabled)
- Each filter section is a `Collapsible` (vertically collapsible with chevron toggle)
- Saved Searches moves from sidebar to a popover/dropdown in the main content header area

## Real-Time Apollo Search

Every filter change immediately triggers a search:
1. `updateCriteria()` updates local state AND immediately calls `onUpdateSearchCriteria(newCriteria)`
2. No more "Save & Refresh" button — remove it
3. The edge function `get-job-matching-candidates` is called on every change (it already handles the full search flow)
4. A small loading spinner appears on the candidate table during refresh
5. To prevent hammering Apollo on rapid changes, add a **minimal debounce (800ms)** at the hook level in `useSourcingProjectCandidates` — the user said "immediate" but we need at least a small guard against rapid-fire API calls from multiple checkbox toggles

## Changes by File

### 1. `src/pages/Find.tsx` — Major restructure
- Remove `SidebarProvider` and `SourcingSidebar` entirely
- Add standard `PageHeader` with title "Find"
- New layout: `flex` row with filter panel (`w-72 shrink-0`) + main content area
- Filter panel is a new component `FindFilterPanel` rendered directly (no Sidebar primitives)
- Saved Searches becomes a compact selector/popover in the project header area
- When no project selected: show the AIJobAssistant in the main area, filter panel shows "Select or create a search to see filters"
- When project selected: filter panel populated, main area shows `SourcingProjectView`
- Lift `editableCriteria` state here — on every change, debounce and auto-save + refetch

### 2. New: `src/components/sourcing/FindFilterPanel.tsx`
- Plain `div` with `w-72 border-r overflow-y-auto h-full`
- Each filter section wrapped in `Collapsible` with `CollapsibleTrigger` showing section label + chevron
- Sections: Job Titles, Keywords, Locations, Seniority, Company Size, Industry, Target Companies, Experience
- Below separator: Result Filters (Has Email, Has Phone)
- Uses same `FilterCheckboxGroup` for checkbox-based filters, compact `Input + Plus + badges` for text-based
- Props: `criteria`, `onCriteriaChange`, `resultFilters`, `onResultFiltersChange`, `disabled` (when no project)

### 3. `src/components/sourcing/SourcingProjectView.tsx` — Simplify
- Remove the `SourcingProjectHeader` from here — the header info (project name, status, actions) moves to a compact bar below the page header
- The saved searches selector (project switcher) replaces the old sidebar project list

### 4. `src/components/sourcing/SavedSearchSelector.tsx` — New
- A popover/dropdown that lists saved searches (like `SavedViewSelector` pattern)
- Shows current project name as trigger, dropdown lists all projects with search/filter
- "New Search" button inside

### 5. Delete `src/components/sourcing/SourcingSidebar.tsx`
- All its content moves to `FindFilterPanel` and `SavedSearchSelector`

### 6. Auto-search mechanism
- In `Find.tsx`: when `editableCriteria` changes, use a `useEffect` with an 800ms debounce timer that calls `handleUpdateSearchCriteria(editableCriteria)`
- This saves to DB and triggers `refetchCandidates` (calls the Apollo edge function)
- Show a subtle loading state (spinner overlay on the table) during refresh
- Remove the `hasChanges` / "Save & Refresh" pattern entirely

## Files Summary

| File | Action |
|------|--------|
| `src/pages/Find.tsx` | Major rewrite — standard page layout, no Sidebar |
| `src/components/sourcing/FindFilterPanel.tsx` | New — vertical collapsible filter panel |
| `src/components/sourcing/SavedSearchSelector.tsx` | New — popover for switching between saved searches |
| `src/components/sourcing/SourcingProjectView.tsx` | Simplify — remove header duplication |
| `src/components/sourcing/SourcingSidebar.tsx` | Delete |


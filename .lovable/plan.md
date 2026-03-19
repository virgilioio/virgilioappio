

# Redesign Find Page: Standard Layout + Table-First Content Area

## Overview

Align the Find page with the Jobs/Candidates page structure: banded header section with divider, floating card filter sidebar, and a table-like main content area that starts as the Gio prompt input and transforms into the actual candidate table when results load.

## Layout Structure

```text
┌──────────────────────────────────────────────────────────────┐
│  Section(banded): PageHeader "Find"                          │
│─────────────────────────────────── border-y (the divider) ───│
├──────────────────────────────────────────────────────────────┤
│  p-6 content area                                            │
│  ┌─────────────┐  ┌────────────────────────────────────────┐ │
│  │ Filter Panel │  │ SavedSearchSelector + action buttons   │ │
│  │ (Card,       │  │────────────────────────────────────────│ │
│  │  rounded-lg, │  │                                        │ │
│  │  floating,   │  │  [No project]: Gio avatar + prompt     │ │
│  │  shadow)     │  │  [Generating]: GioThinkingHeader       │ │
│  │              │  │  [Has project]: Candidate table + tabs  │ │
│  │ ▼ Job Titles │  │                                        │ │
│  │ ▼ Keywords   │  └────────────────────────────────────────┘ │
│  │ ▼ Seniority  │                                            │
│  │ ...          │                                            │
│  └─────────────┘                                             │
└──────────────────────────────────────────────────────────────┘
```

## Changes

### 1. `src/pages/Find.tsx` — Restructure layout

- Wrap header in `<Section variant="default" banded container>` with `<PageHeader title="Find" />` — this gives the divider line matching Jobs/Candidates
- Main content area uses `<Section container>` for consistent padding
- Layout: `flex gap-6` with filter panel (left) + main content card (right)
- Main content is a `Card` component containing:
  - **Toolbar row** (top, inside card): `SavedSearchSelector` popover (left) + action buttons (right) — same pattern as the filter toolbar in Jobs/Candidates tables
  - **Body**: When no project selected OR generating → show Gio avatar + prompt input (AIJobAssistant) centered inside the card. When project loaded → show `SourcingProjectView` tabs + candidate table
- The transition from prompt → table happens naturally inside the same card
- Remove the `disabled` prop gating on filters — filters are always visible/editable even without a project

### 2. `src/components/sourcing/FindFilterPanel.tsx` — Floating card style

- Wrap the entire panel in a `Card` component instead of a plain `div` with `border-r`
- Use `rounded-lg shadow-sm` for the floating card look
- Remove `border-r`, use card's built-in border + shadow
- Fixed width `w-72`, `overflow-y-auto`, full height of the content area
- Remove the `disabled` state and the "Select or create a search" empty message — filters are always shown with their default/empty state
- When no criteria exists, initialize with empty defaults so the collapsible sections still render

### 3. `src/components/sourcing/SourcingProjectView.tsx` — Remove redundant header

- Remove the `SourcingProjectHeader` wrapper and its `border-b` container — project actions (archive, delete, visibility, link-to-job) move to the `SavedSearchSelector` area or become dropdown menu items
- The tabs (Chat, Candidates, Saved, Archived) remain but render directly without the extra header chrome

### Files Summary

| File | Action |
|------|--------|
| `src/pages/Find.tsx` | Use Section+PageHeader for banded header; Card-based main content with toolbar; filters always enabled |
| `src/components/sourcing/FindFilterPanel.tsx` | Card wrapper instead of border-r div; always show filter sections (no disabled state) |
| `src/components/sourcing/SourcingProjectView.tsx` | Remove SourcingProjectHeader container, keep tabs + table |


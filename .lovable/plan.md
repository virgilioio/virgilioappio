# Candidates page — promote rail + filters to floating white cards

Purely visual. No logic, no data, no hook changes.

## What the mockup shows vs what we have

- **Left rail (Searches / Smart Lists / Tags)**: in the mockup it's a **floating white card** with rounded corners sitting on cream, with breathing room on all sides. Today it's a flush full-height column (`border-r border-virgilio-border bg-surface-primary`) glued to the page edge.
- **Filters block (breadcrumbs row + Boolean/Everything/Ask tabs + search input + filter chips + Reset / Save as search)**: in the mockup these all live **inside a single white rounded container** with a soft border — same treatment as the Jobs filters card. Today they sit loose directly on the cream background.
- **Table block** (toolbar + rows + footer) is its own white card in the mockup. Today the rows already render on white but without the outer rounded card chrome.

## Changes

### 1. `src/components/candidates/list/CandidatesSearchesRail.tsx`
- Drop `border-r border-virgilio-border` and full-bleed full-height styling.
- Aside becomes a self-contained card: `bg-surface-primary border border-virgilio-border rounded-2xl shadow-sm overflow-hidden`, fixed width `260px`, with internal scroll on the content area only.
- Inner padding unchanged.

### 2. `src/pages/Candidates.tsx` — body layout
- Wrap the rail column in `pl-6 py-4` so the card has cream margin on left/top/bottom. Keep `gap-4` between rail and main.
- Main column gets the same `pr-6 py-4` rhythm (it currently uses `px-4 sm:px-6 py-5`).
- Wrap the **filters block** in a white card:
  - Container: `<section className="bg-surface-primary border border-virgilio-border rounded-2xl shadow-sm p-4 space-y-3">`
  - Contents: `SavedSearchToolbar` (top), then `SearchModeTabs`, `CandidateSearchBar` (with its trailing `SaveSearchPopover`), `FilterChipsRow`.
  - The "Reset / Save as search" cluster currently lives inside the search bar trailing area — leave it.
- Wrap the **table block** in a second white card:
  - Container: `<section className="bg-surface-primary border border-virgilio-border rounded-2xl shadow-sm overflow-hidden">`
  - Contents: `BulkActionBar` (when shown — its dark pill stays anchored above the table inside the card), `CandidatesTable`, `CandidatesFooter`.
  - Add a thin `divide-y divide-virgilio-border` only if the table doesn't already render its own top border.

### 3. Spacing tune-ups
- Outer body wrapper: `gap-4 px-0` so the two cream margins come from the rail/main padding, keeping the layout symmetric.
- Header band already uses `px-6 pt-6 pb-4` — no change.

## Out of scope
- Internals of `SavedSearchToolbar`, `CandidatesTable`, `BulkActionBar`, `CandidatesFooter` — they keep their current markup, only the outer wrappers change.
- Tag list, smart-list, and saved-search row styling inside the rail.
- Any change to `Jobs.tsx`, top nav, or sidebar (already floating).

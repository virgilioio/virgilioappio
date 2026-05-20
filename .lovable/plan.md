# Find page — align with Jobs / Candidates visual system

Goal: bring the Find page header, padding, animations, sidebar and filters chrome in line with the Jobs and Candidates pages, matching the attached screenshot. Functional behavior (search, auto-create project, candidate fetching) stays exactly as-is.

## Reference cues from the screenshot

- Page header: `Find.` (Poppins semibold, purple period), with a sub-row "Sr. Product Designer · Last refreshed 2 min ago · 412 sourcing credits" using dot+text markers (same pattern Jobs uses for "open / paused / closed").
- Top-right buttons: `My searches` (secondary) and `+ New search` (primary).
- Left rail = white `Card` titled "Search criteria" with a `Reset` link, collapsible sections, and a full-width `Re-run search` primary CTA at the bottom + credits caption.
- Right pane = white `Card` containing the saved-search trigger, project actions, AI summary banner, tab strip, and the candidate list (unchanged internals).

## Changes

### 1. `src/pages/Find.tsx` — page shell

Replace the current header / Section / AppContainer block with the Jobs pattern:

- Wrapper: `h-[100dvh] sm:h-[calc(100dvh-3.5rem)] flex flex-col overflow-hidden bg-virgilio-cream`.
- Scrollable inner: `flex-1 min-h-0 overflow-auto`.
- Content container: `container mx-auto py-6 sm:py-8 lg:py-12 px-4 sm:px-6 lg:px-8 space-y-6 animate-fade-in` (matches Jobs).
- `<header>` block identical to Jobs:
  - Left: `Find.` title (`text-[28px] sm:text-[32px]`, Poppins semibold, `-0.04em`, purple period) + dot+text counter row:
    - active search name (purple dot) when a project is selected
    - `Last refreshed Xm ago` (neutral dot) — driven by `currentProject.updated_at`
    - `N sourcing credits` (neutral dot) — from `useSourcingCredits`
  - Right: `<Button variant="secondary" size="md" icon={Bookmark}>My searches</Button>` (opens the existing SavedSearchSelector popover) + `<Button variant="primary" size="md" icon={Plus} onClick={handleNewSearch}>New search</Button>`.
- Below the header, a two-column flex (`flex gap-6`) holding the left filter rail and the right project card. Both fill the remaining height inside the scroll area.

Remove the in-card `SavedSearchSelector` and `SourcingProjectActions` row at the top of the right pane — the saved-search popover is now anchored to the top-right `My searches` button, and project actions move into the project card header (see step 3).

### 2. `src/components/sourcing/FindFilterPanel.tsx` — left rail polish

- Keep as a `Card` (rounded, hairline border, same `bg-card`) — already matches Candidates' filter card.
- Header row: `Search criteria` (Poppins semibold 13.5px, text-text-primary) + right-aligned `Reset` ghost button (resets criteria + result filters in one click).
- Add a small caption under the header: "Edit anything to re-run the search." (text-body-sm, text-text-tertiary).
- Section labels: switch from 10px uppercase muted to the Candidates pattern — 11.5px Inter, `text-text-secondary`, `font-medium`, no uppercase. Keep icons.
- Footer pinned inside the card: full-width primary `Re-run search` button (`variant="primary"`, Sparkles icon), plus tiny caption `Uses ~N sourcing credits · X remaining`.
- No width change beyond making it `w-[280px] shrink-0` to match the screenshot.

### 3. `src/components/sourcing/SourcingProjectView.tsx` — project card chrome

Move the project header bar inside the project card to mirror the screenshot:

- First row: saved-search dropdown trigger (project name + "107 candidates · last refreshed 2 min ago") on the left, action cluster on the right (`Auto-refreshing` pill, `Refresh now`, `Link to job`, `Share`, kebab). Use existing `SourcingProjectActions` for the right cluster.
- Second row: AI summary banner (sparkle icon + counts line + `Why these results?` link) — already exists; keep but normalize spacing.
- Third row: tabs (`All`, `Strong fit`, `New`, `Saved`) using the same flat tab strip we standardized in Candidates (`SearchModeTabs` look — bg `#FAFAF7` for active, no background for inactive), plus right-aligned `Sort: AI fit` and `Select`.
- Candidate list / table rendering stays untouched.

Only the visible structure and Tailwind classes change here — no edits to data, filters, or selection logic.

### 4. `src/components/sourcing/SavedSearchSelector.tsx` — trigger only

Expose an optional `trigger` prop (or hide the built-in trigger when an external trigger is provided) so the page can mount the popover under the new top-right `My searches` button. The dropdown panel itself stays unchanged.

## Out of scope

- Sidebar (`SourcingSidebar`) — already aligned, untouched.
- Candidate card / table internals, AI banner copy, project actions logic.
- Any data fetching, mutations, routing, or business rules.
- Jobs page and Candidates page — reference only, no edits.

## Technical notes

- Counter dots: reuse the exact markup Jobs uses (`<span className="h-1.5 w-1.5 rounded-full bg-...">`) for color parity.
- `Last refreshed`: format with `formatDistanceToNow(new Date(currentProject.updated_at), { addSuffix: true })`.
- Sourcing credits: read from existing `useSourcingCredits` hook (already imported transitively via `useSourcingCreditWarnings`).
- Animation: top-level container gets `animate-fade-in` (same class Jobs / Candidates use) for the slight enter transition.

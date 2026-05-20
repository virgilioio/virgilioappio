# Candidates Page Revamp — Plan

Rebuild `/candidates` to match the mock (`22_Candidates_talent_database`) pixel‑close and wire every surface to real data. The current page is a single full‑width table; the new page becomes a three‑zone workspace: header KPIs, left **Searches** rail, and a main panel with **search modes + filter chips + table + bulk bar + footer**.

Reuses the Gio Foundation tokens (Poppins/Inter, table primitives, badges, dropdowns) and the existing `useSavedViews('candidates')` hook.

---

## 1. Page layout

```text
+---------------------------------------------------------------------+
| Candidates 1,247   • 412 active · 86 awaiting · 62 fav · 28 new …   |
|                              [Import CSV] [Bulk upload] [+ Add] ⋯   |
+----------------+----------------------------------------------------+
|  Searches      |  My searches > Design systems leads · NYC          |
|  + New         |  47 results · 3 new        Alert me · Share · Exp. |
|  ─ My searches |  [Everything] [Boolean] [Ask in plain English]     |
|  Design ... 47 |  [search input ............................. ⌘K]  |
|  Senior PMs 22 |  [Skills ×] [Location ×] [Stage ×] [+ Add filter]  |
|  Backend Go 89 |  Editing search · Save changes · Reset · Save as…  |
|  ─ Shared      |  ────────────────────────────────────────────────  |
|  ─ Smart lists |  ☑ 3 selected · Select all 47 · Clear   [actions]  |
|  All 1247      |  CANDIDATE  SKILLS  PIPELINE  AI FIT  LOC  SRC  ⋯  |
|  Active 412    |  Lena Park …                                      |
|  Awaiting 86   |  …                                                 |
|  Favorites 62  |                                                    |
|  New week 28   |  Showing 1–25 of 47 · Rows per page 25 · Load more |
+----------------+----------------------------------------------------+
```

Fixed viewport `h-[100dvh]`. Left rail collapses on mobile to a sheet trigger; main panel scrolls internally.

## 2. New / restructured files

```text
src/pages/Candidates.tsx                 # thin shell, composes the parts below
src/components/candidates/list/
  CandidatesHeader.tsx                   # title + KPI chips + top‑right actions
  CandidatesSearchesRail.tsx             # left sidebar (saved + smart lists)
  SavedSearchItem.tsx
  SmartListItem.tsx
  SearchModeTabs.tsx                     # Everything / Boolean / Ask in plain English
  CandidateSearchBar.tsx                 # input + ⌘K hint + AI submit
  FilterChipsRow.tsx                     # active filter pills + Add filter popover
  SavedSearchToolbar.tsx                 # breadcrumb + Alert me/Share/Export + edit/save/reset
  BulkActionBar.tsx                      # 3 selected · Add to job / Email / Tag / Archive
  CandidatesTable.tsx                    # rewrite of IndependentCandidateTable using Gio Table primitives
  cells/
    CandidateIdentityCell.tsx            # avatar + name + ♥ + “New” badge + role line
    SkillsCell.tsx                       # up to 3 skill chips + “+N”
    PipelineCell.tsx                     # status dot + job link OR “Not in pipeline”
    AiFitCell.tsx                        # 92 + tiny sparkline
    SourceCell.tsx                       # square avatar (R/L/A/C) + label
    AddedCell.tsx                        # date + attributed user
  CandidatesFooter.tsx                   # Showing X of Y · Rows per page · Load more
src/hooks/useCandidateKpis.ts            # tenant‑scoped counts via new RPC
src/hooks/useCandidateBooleanFilter.ts   # client‑side boolean parser
supabase/functions/candidates-nl-search/index.ts  # NL → filters via Lovable AI Gateway
```

`IndependentCandidateTable.tsx` is replaced by `CandidatesTable.tsx`. `CandidateFiltersPanel.tsx` is kept and reopened from the **Add filter** popover for filters that don’t have a quick chip.

## 3. Data work

### 3.1 KPI RPC (header counts)

New SQL function `public.get_candidate_kpis(_tenant_id uuid)` returning:

```text
total              -- all candidates in tenant
in_active_pipeline -- distinct candidates with an open job_candidates row
awaiting_outreach  -- candidates with 0 outbound emails AND no scorecards in 7d
favorites          -- saved_candidates count for current user
new_this_week      -- created_at >= now() - 7d
```

`SECURITY DEFINER`, `SET search_path = public`, granted to `authenticated`. Tenant scope enforced via `user_has_tenant_access(_tenant_id)`. Wrapped by `useCandidateKpis()` (react‑query, 60s stale).

### 3.2 Saved searches

Reuse the existing `saved_views` table via `useSavedViews('candidates')`. A “saved search” = `{ name, filters: CandidateFilters, extra_state: { query, mode } }`. Smart Lists are five hardcoded virtual entries (All, In active pipeline, Awaiting outreach, Favorites, New this week) that resolve to preset `CandidateFilters`.

### 3.3 Boolean search

Pure client‑side parser (`useCandidateBooleanFilter`) — supports `AND`, `OR`, `NOT`, parentheses, quoted phrases. Runs against `name + email + skills + company + role`. Falls back to plain text on parse error with a small inline error.

### 3.4 Ask‑in‑plain‑English (AI mode)

Edge function `candidates-nl-search` calls Lovable AI Gateway (`google/gemini-3-flash-preview`) with structured output (`Output.object`) returning a partial `CandidateFilters` + optional free‑text `query`. The client merges that into the filter context and switches the mode tab back to **Everything** with the chips already populated. Errors (429/402) surface as a toast banner inside the search bar.

## 4. Interaction details

- **Header KPI chips** are clickable — clicking applies the matching Smart List preset.
- **Saved search toolbar** shows `Editing search · Save changes · Reset · Save as new` when current filters diverge from the loaded view (compare via stable JSON hash).
- **Filter chips row** renders one chip per non‑empty filter group; click opens its popover (`FilterChipPopover` from the design system). `+ Add filter` opens a menu listing all hidden filter dimensions.
- **Bulk action bar** swaps in on selection: Add to job (existing `BulkAddToJobPipelineDialog`), Email (`BulkEmailDialog`), Tag (new lightweight popover, reuses `useCandidates` tag mutation), Add to search (creates / extends a saved view), Archive (soft‑delete via existing `deleteCandidate`).
- **Footer**: `Load 25 more` button + `Rows per page` selector (25/50/100). Pagination is client‑side over the already‑fetched dataset (the page fetches all tenant candidates today via `useIndependentCandidates`); we keep that for v1.
- **Mobile**: header stacks, Searches rail becomes a left Sheet, table collapses to single‑column cards (reuse existing mobile pattern from Pipeline).

## 5. Style adherence

- Table = `<Table density="default">` with `IdentityCell`, `StatusCell`, `NumericCell`, `ActionCell` from the design system. Selected row = 2px purple left rail, hover = `#FAFAF7`.
- Buttons follow §2: top‑right `Add candidate` = `primary`, `Bulk upload` / `Import CSV` = `secondary`, kebab = `ghost iconOnly`. Bulk bar: `Archive` = `danger`.
- Source badges use the `R / L / A / C` ink avatars (Referral / LinkedIn / Apollo / Careers) — categorical, no dot.
- AI Fit sparkline = 24×12 inline SVG, color from `kpi-visualization-standards`.
- Saved Search list row = 30h, Inter 12.5, hover `#F1F0EC`, selected `#EDE4FF` + 2px purple left rail.

## 6. Out of scope (defer)

- Server‑side pagination / virtualization (current dataset is tenant‑scoped and small enough to keep client‑side).
- Per‑user notification rules behind **Alert me** (button is present but opens a “Coming soon” popover for now).
- Real‑time updates beyond the existing react‑query invalidations.

## 7. Acceptance checks

1. `/candidates` matches the mock at desktop (1347×875): header KPIs, Searches rail, search modes, chips row, table, bulk bar, footer.
2. Header KPI counts come from `get_candidate_kpis` and update after add/delete/import.
3. Creating a saved search from current filters appears under **My searches** and is reloadable.
4. Boolean mode: `Figma AND ("design systems" OR tokens) NOT junior` narrows results correctly.
5. Ask‑in‑plain‑English mode: typing *“senior product designers in NYC who know Figma”* fills Skills/Location/Seniority chips.
6. Selecting rows swaps the toolbar to the bulk bar; Archive removes rows optimistically.
7. All controls keyboard‑navigable; focus rings = `ring-virgilio-purple/30`.
8. No regressions for `useIndependentCandidates`, CSV import, bulk upload, or the candidate profile sheet (`?openCandidate=`).

# Global Search Dropdown — Revamp

Rebuild the top-bar global search dropdown to match the new "Gio ATS Global Search v1.0" mocks. One panel, five states, six entity kinds, one row pattern, keyboard-first.

## What the user gets

A single anchored panel under the topbar search input (≈600 wide). The user types once and the panel cycles through five states based on input:

1. **Empty** — recent searches, jump-to (saved searches), and command actions (Add candidate, Create job, etc.).
2. **Mixed results** — typing < 3 chars or no scope chosen: grouped sections (Candidates, Jobs, Companies, Saved) capped at 4–5 per group with "See all N results for X" header.
3. **Scoped** — user clicks a scope chip (Candidates / Jobs / Companies / Saved): only that entity, with inline filter chips (Location, Skill, Stage) where applicable.
4. **Ask Gio (AI)** — user clicks the "Ask Gio" pill or natural-language query: shows "Gio understood" interpretation chips + ranked results + "Refine" / "Save as search" actions.
5. **No results** — empty state with recovery paths: "Ask Gio: …", "Add X as a new candidate", "Create a new job".

All five states share the same chrome, the same scope chips, the same keyboard footer.

## Result row anatomy (one pattern, six entity kinds)

- 9px / 14px padding, 12 gap, radius 8, 16px tall
- **Glyph**: 30px avatar (candidates) or tinted 30px tile (jobs / companies / saved / recent / command)
- **Title**: matched substring wrapped in a soft `#FFF4B8` highlight (never bold pastel, never purple)
- **Sub-meta** (optional): role @ company / department · open · N candidates / stripe.com · 12 contacts / etc.
- **Right meta**: stage chip (candidates), "Jobs" / "Companies" label, `⌘`-key hint (commands), keyboard-cursor `↵`
- **Row states**: idle / hover (`#FAFAF7`) / selected (2px noir left bar + stone wash) — never purple

## Keyboard

`↑ ↓` navigate · `↵` open · `⌘↵` open in new tab · `tab` cycle scope · `esc` close (or clear). Persistent footer inside the panel showing these. `⌘K` opens (replaces current `⌘/`).

## Six entity kinds

| Kind | Glyph | Title | Sub | Right meta |
|---|---|---|---|---|
| Candidate | 30px avatar + entity badge | name (highlight) | role @ company | stage chip |
| Job | green tinted tile | title | department · status · N candidates | "Jobs" |
| Company | blue tinted tile | name | domain · N contacts | "Companies" |
| Saved search | purple tinted tile | name | "Saved search · N candidates · N new" | "Searches" |
| Recent | grey tile (clock) | query | "in candidates" | timestamp |
| Command | green tile (+) | "Add candidate" | — | `⌘N` |

## Scope (chips inside panel)

`All · Candidates · Jobs · Companies · Saved` + right-aligned `Ask Gio` pill (lilac).

## Technical plan

### New components (under `src/components/search/v2/`)

- `GlobalSearchPanel.tsx` — panel chrome, anchoring, scope chips, footer, state machine
- `SearchScopeChips.tsx` — segmented control + Ask Gio pill
- `SearchEmptyState.tsx` — recent + jump-to + commands
- `SearchMixedResults.tsx` — grouped sections w/ "See all" header
- `SearchScopedResults.tsx` — single-entity list + inline filter chips
- `SearchAskGio.tsx` — interpretation chips + ranked list + Refine
- `SearchNoResults.tsx` — recovery paths
- `SearchResultRow.tsx` — single row primitive (the anatomy above)
- `SearchKeyboardFooter.tsx` — `↑↓ navigate · ↵ open · ⌘↵ new tab · tab scope`
- `useSearchHighlight.ts` — wraps matched substring in `<mark>`
- `useRecentSearches.ts` — localStorage, per-user, capped at 8

### Hook changes

- Extend `useGlobalSearch` to:
  - accept a `scope` arg (`all | candidates | jobs | companies | saved`)
  - search **companies** (CRM `companies` table — confirm it exists, else skip Companies kind in v1)
  - search **saved searches** via existing `useSavedViews` data
  - return per-group totals and capped previews
- New `useAskGioSearch.ts` — calls the existing `candidates-nl-search` edge function (already deployed) and surfaces interpretation chips.

### Replacing the old component

Drop-in replace `GlobalSearchBar.tsx` so the topbar input is unchanged but the dropdown points at the new panel. Keep `⌘K` (deprecate `⌘/`). Mobile button still opens the existing `SearchResultsDialog` for now.

### Tokens (Gio Foundation v1.0)

Panel: radius 12 · shadow `0 12px 32px -8px black/18` · pad 4 · width 600
Row: 16px tall · 9/14 pad · 12 gap · radius 8 · hover `#FAFAF7` · selected 2px noir bar + `#F1F0EC`
Highlight: `#FFF4B8` wash (never bold)
Group label: 10px caps `#8B8F9E` tracking +0.06em
`kbd`: existing `kbd` style from style guide

### Out of scope (this round)

- Companies search only wired if `companies` table is reachable from CRM scope; otherwise the chip is hidden in v1.
- The Cmd palette (CommandDialog) is not changed — this is the topbar dropdown only.
- No backend schema changes.

## Open question

The mock shows a **Companies** scope. The project has a CRM (`useDeals`, etc.) but I want to confirm we should pull from the CRM `companies` table for this top-bar search, or skip Companies in v1 and ship Candidates + Jobs + Saved + Recents + Commands + Ask Gio first. I'll default to **include Companies** unless you say otherwise.

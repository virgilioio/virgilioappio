# Sourcing project results — re-design pass

Redesigning the results view of a sourcing project (`/find/:projectId`), with the case of a project **not linked to a job** as the reference. The reference screenshot proposes a denser, more "intelligent" results surface — banners that explain the run, a strong bulk-action bar, AI-fit tabs, and richer candidate rows with a prominent fit score. Most of these elements do not exist yet in the current build.

## What the screenshot proposes vs. what exists today

```text
SCREENSHOT (target)                              CURRENT (Find › SourcingProjectView)
───────────────────────────────────────────────  ────────────────────────────────────
Saved-search bar:                                Tabs row (Chat with Gio / Candidates
  "Sr. Product Designer (NYC + Remote) v"          / Saved / Archived) — colourful,
  107 candidates · refreshed 2 min ago             oversized, no project chooser, no
  [Auto-refreshing] [Refresh now] [Share] […]      auto-refresh / share controls
                                                  
Yellow link-to-job banner                        Missing — only a dialog reachable
                                                  from a kebab menu
                                                  
Lilac AI summary banner                          Missing — no run summary at all
  "107 preview · 28 strong · 47 good · …
   Sourced from LinkedIn 86 / Apollo 21 /
   Internal 12 · Top match: Priya Iyer 94"
  [Why these results?]
                                                  
Dark bulk-action bar                             Light grey bar, single action
  [Collect · credits] [Save for later]            ("Unlock N profiles")
  [Not a fit] [×]
                                                  
Header row                                       "Page 1 of N" pager, no tabs, no
  "Showing 1–25 of 107" · tabs                    fit-segments
  All / Strong fit / Collected / New / Saved
  Sort: AI fit · Select all
                                                  
Card-style row                                   Dense single-cell row, badges +
  Avatar · Name + match badges · headline         metadata chips at the bottom,
  Location · exp · activity · LI · email          small "Reveal (1 credit)" button
  Skill chips (green check = matched)             on the right
  Add to job · Reach out · View profile
  AI FIT 94 (right rail)
```

The behaviour underneath (collect, save, archive, link-to-job, filtering, sort) is already wired up in `SourcingCandidateTable` and `SourcingProjectView` — this is a presentation re-design, not a logic rebuild.

## Goals

1. Make the page feel like an AI workspace: the system explains what it found, why, and how confident it is.
2. Put the **link-to-job** decision front and centre while the project is unlinked, without blocking work.
3. Replace the dense row with a scannable card row that surfaces fit score, matched skills, and the one or two right next actions.
4. Make bulk actions a primary citizen (dark bar, multiple verbs).
5. Add fit-based segments (All / Strong fit / Collected / New / Saved) alongside the existing tabs concept, so users can slice results without leaving the page.

## Scope of this pass

Visual + structural changes to the results surface only. Filtering logic, data fetching, RLS, and the underlying mutations are untouched. The four big tabs (Chat with Gio, Candidates, Saved, Archived) stay — we are re-skinning the **Candidates** tab content and the chrome immediately above it.

### Files to change

- `src/components/sourcing/SourcingProjectView.tsx` — slimmer top bar; promote the saved-search selector + auto-refresh / refresh / share controls; drop the colourful gradient tab strip in favour of a quieter Gio Foundation tabs row.
- `src/components/sourcing/CandidatesTab.tsx` — host the three new banner zones (link-to-job, AI summary, bulk bar) and the results-toolbar (Showing X–Y of Z · fit segments · Sort · Select all) above the table.
- `src/components/sourcing/SourcingCandidateTable.tsx` — rewrite the row composition: avatar · identity block · metadata line · matched-skill chips · action cluster · right-rail AI FIT score. Strip badge / metadata-chip stack at the bottom. Keep all existing handlers (collect, bulk collect, add to pipeline, sheet open) intact.
- New `src/components/sourcing/ResultsRunSummary.tsx` — lilac AI summary banner with counts, source breakdown, top match, and "Why these results?" disclosure.
- New `src/components/sourcing/LinkToJobBanner.tsx` — yellow inline banner with "Link to job" (opens existing `LinkToJobDialog`) and "Continue without" (dismiss for the session).
- New `src/components/sourcing/CandidatesBulkBar.tsx` — dark bulk-action bar with Collect / Save for later / Not a fit / Clear, replacing the existing inline bulk block.
- New `src/components/sourcing/CandidatesToolbar.tsx` — Showing X–Y of Z label, fit segments (All / Strong fit / Good / Possible / Collected / Saved counts derived from data), Sort menu (AI fit / Recent activity / Experience), Select-all toggle.

No new tables, no new edge functions, no schema changes.

## Visual contract (Gio Foundation tokens only)

- Banners follow the standardized alert pattern (`Alert` with `variant`): yellow for link-to-job (warning), lilac for AI summary (info / AI). No bespoke colour values.
- Bulk bar uses the inverted top-bar treatment used elsewhere (citron-noir `#0d0d09` background, cream text, `Button` with `onDark`).
- AI FIT score on the right rail uses the existing AI-fit semantic — large Poppins number, tone derived from band (≥85 green, ≥70 blue, ≥55 yellow, else neutral). No new badge palette.
- Tabs row uses standard `Tabs` (no gradients, no pulse glow) per the tables / page-header memory.
- Row hover = `#FAFAF7`, selected = `#FAF8FF` with 2 px purple left rail — matches the global tables foundation.

## Behavioural notes

- "Auto-refreshing" indicator reflects the existing refetch cadence; no new polling.
- Fit segments are pure client-side slicing of `candidates` by `match_tier` and `display_source` — same data already passed in.
- "Why these results?" opens the existing `RoleInterpretationDrawer` (already in the codebase) so we don't introduce new content.
- The bulk bar exposes "Save for later" and "Not a fit" by wiring into existing `useSavedCandidates` mutations (save / archive) — no new endpoints.
- Link-to-job uses the existing `LinkToJobDialog` and `handleLinkToJob` already exposed via `SourcingProjectView`.
- Mobile: banners stack, toolbar collapses to count + sort, bulk bar pins to bottom (consultation-first — no row-level edits beyond what mobile already allows).

## Out of scope

- The four-tab strip (Chat with Gio / Candidates / Saved / Archived) stays as-is structurally; only the visual style is calmed down.
- Saved + Archived tab internals.
- Sidebar (`SourcingSidebar`), page-level header chip row in `Find.tsx`.
- Any change to scoring, sourcing providers, credits logic.

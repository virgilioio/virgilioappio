# Postings tab — KPI strip, toolbar, perf table

Add a new "Postings" tab between Job Dashboard and Setup, replacing the right-rail "Job posts" list in the Setup sidebar (still accessible via Setup's "Manage postings" quick link). Reuses `useJobPostings` and the existing `PostingSheet`.

## Layout

```text
+----------------------------------------------------------------------+
| KPI strip (4 cards)                                                  |
|  POSTINGS  |  TOTAL APPLICATIONS  |  TOTAL VIEWS  |  MONTHLY SPEND   |
|  4 cards · last = dark "citron-noir" card with lightning glyph       |
+----------------------------------------------------------------------+
| [Search…]  [Status: All ▾]  [Language ▾]   Sorted by … · [+New posting]|
+----------------------------------------------------------------------+
| POSTING            STATUS      DISTRIBUTION   PERFORMANCE    DATES   |
| Senior PD — DS     ● Live      A I W Z  4ch   38 apps · 4.8%  May 8  |
|  /jobs/…ds         since May 8                4,214 views    Upd 2d  |
| [Primary] EN(US)…                                            ⤴ Edit …|
| …                                                                    |
+----------------------------------------------------------------------+
| Gio-suggestion banner (lilac): "Gio suggests a 5th posting…"         |
+----------------------------------------------------------------------+
```

## KPI strip

Four pulse cards, 1×4 grid (responsive to 2×2 ≤md):
- **Postings** — count + helper "{live} live · {drafts} drafts/paused".
- **Total applications** — sum across postings + green "+N this week" if >0.
- **Total views** — sum + "avg X% apply rate".
- **Monthly spend** — dark `#0d0d09` card, cream text, lightning glyph. "$XXX + Y credits" subtitle. Hidden when none.

KPI numbers in Poppins 600 tracking -0.04em, 28px.

## Toolbar

`TableToolbar` pattern: 30h `TableSearch` (≤280w) left, `Status: All ▾` `FilterChipPopover` (All / Live / Paused / Draft / Closed), `Language ▾` `FilterChipPopover` (distinct languages from postings). Right side: "Sorted by performance · descending" muted label + `New posting` primary `Button` (icon Plus) that opens `PostingSheet` in create mode.

## Table

`<Table density="default">` with columns:

- **POSTING** — `IdentityCell` style: title 13.5px medium, mono `/jobs/{slug}` row, third tiny line of meta chips (language(s), audience tags). When `is_primary`, a small lilac `Primary` badge sits inline after the title.
- **STATUS** — `StatusCell` with one Badge dot (Live=green / Paused=yellow / Draft=neutral / Closed=red) + helper line "Live since May 8" / "Paused 4d ago" / "Not yet published" / "Closed May 15" using `formatDistanceToNowStrict` and `Xd` style.
- **DISTRIBUTION** — Channel chips: small 22h colored squares with one-letter glyph (A=Apollo, I=Indeed, W=Wellfound, Z=ZipRecruiter, H=HiringRoom, X=Xing — derived from `external_postings` keys or empty), then "{N} channels". If only internal site → single black "A" + "1 channel".
- **PERFORMANCE** — Two stacked `NumericCell`-ish lines:
  - `{applications}` apps · green `{apply_rate}% apply rate`
  - eye icon + `{views}` views
  Pulled from `posting_metrics` if available, otherwise computed via `useJobPostingMetrics` hook (new, see Technical).
- **DATES** — Posted {date} / Updated {Xd ago}. Drafts show "Draft / Updated yesterday".
- **ACTIONS** — `ActionCell` (32px col, opacity 0→1 on row hover): external-link icon (opens `/p/{slug}` new tab) + secondary `Edit` button (opens `PostingSheet` edit) + `DropdownMenu` with Duplicate, Copy URL, Pause/Resume (toggle), divider, Delete (danger).

Row click anywhere outside ActionCell opens `PostingSheet` in edit.

Empty state: `TableEmpty` with Gio mascot + headline "No postings yet" + body "Publish your first job posting to start receiving applications." + primary `New posting` CTA.

## Gio suggestion banner

Lilac alert banner below the table: avatar Gio sparkle icon, headline "Gio suggests a {N}th posting for {region}", body explaining the gap, right-aligned purple primary `Create from suggestion →`. Only rendered when `gioSuggestion` is non-null; v1 uses a tiny client-side heuristic (if all live postings concentrate in <=2 regions, suggest the largest missing region from candidate locations). Stub returns null if data insufficient — banner just doesn't render.

## Tabs wiring

Add `<TabsTrigger value="postings">Postings</TabsTrigger>` between `candidates` and `sourcing` in `JobDetail.tsx`. Mount `<JobPostingsTabV2>` inside a new `<TabsContent value="postings">` with the standard `flex-1 min-h-0 overflow-hidden` and an inner `overflow-auto bg-[#FAFAF7]` wrapper to match Setup. Also wire the Setup sidebar "Manage postings" quick link to `setActiveTab('postings')` (replace the custom-event stub I left in `JobSetupLayout`).

## Permissions

Restricted viewers: tab visible but read-only — no `New posting`, no row actions menu, edit-on-row-click becomes view-only. Hide Monthly spend KPI.

## Technical

- Rewrite `src/components/jobs/JobPostingsTab.tsx` end-to-end (call the new component the same name to keep the import). Move the old version to `JobPostingsTab.legacy.tsx` only if needed (probably just overwrite — it isn't imported by `JobDetail`).
- New tiny hook `src/hooks/useJobPostingMetrics.ts` returning `{ applications, views, applyRate }` per posting. v1 implementation: 2 queries against `applications` + `job_posting_views` (if exists; if not, return zeros and TODO toast on KPI hover). Confirm schema before adding tables — no DB migrations in this pass.
- Reuse `PostingSheet` for create/edit. No changes to it here (we'll redesign it in the next round).
- Remove the "Job posts" `SectionCard` from the Setup sidebar in a follow-up — out of scope for this pass.

## Out of scope

- Redesign of `PostingSheet` (next round).
- DB schema changes (metrics table, posting languages, primary flag column — confirm each before adding).
- Real "Monthly spend" billing aggregation (display 0 / hide card if no data).
- Gio LLM-driven suggestion; v1 uses heuristic only.

## Files

- Rewrite `src/components/jobs/JobPostingsTab.tsx`.
- New `src/hooks/useJobPostingMetrics.ts`.
- Edit `src/pages/JobDetail.tsx` (add tab trigger + content, wire Manage postings quick link).
- Edit `src/components/jobs/JobSetupLayout.tsx` quick-link handler to use a real callback prop instead of custom event.

# Results view — tighten to match the screenshot

Five targeted fixes on the sourcing results screen. Frontend only.

## 1. Results header bar (above the table)

Replace the current `SourcingProjectHeader` strip with the row from the screenshot:

```text
[ Saved-search selector ▾ ]   ………………………………   [● Auto-refreshing]  [↻ Refresh now]  [↗ Share]  [⋯]
   Sr. Product Designer (NYC + Remote)
   107 candidates · refreshed 2 min ago
```

- Left: a `<Select>`-style combobox showing the current saved search name + meta line underneath; opens the saved-search picker.
- Right cluster: `auto-refresh` status pill (green dot + "Auto-refreshing"), `Refresh now` ghost button with `RefreshCw` icon, `Share` ghost button with `Share2` icon, then the existing ellipsis menu.
- Single row, 56px tall, hairline border underneath. Sits directly above the banner zone.

## 2. Bulk select bar — fix unreadable text

In `CandidatesBulkBar` (the black `#0d0d09` bar), the `X selected · Select all 107` block is rendering in default body color. Force the on-dark palette:

- Count label: `text-white font-medium`
- `Select all 107`: `text-white/80 hover:text-white underline`
- Separator dots: `text-white/30`
- `Clear` link: `text-white/60 hover:text-white`

Pattern is already proven in `BulkActionBar` (`src/components/candidates/list/BulkActionBar.tsx`) — mirror that exactly.

## 3. AI summary banner — match the screenshot

Rework `ResultsRunSummary` so it reads as one tight line, not a generic alert:

```text
[✨]  107 preview candidates · 28 strong fit · 47 good · 32 possible · 2 already collected            › Why these results?
      Sourced from LinkedIn (86), Apollo (21), Internal (12). Top match: Priya Iyer · 94 fit.
```

Changes vs. current:
- Lilac sparkle tile (28px, rounded-full, `bg-virgilio-purple/15`), matching the screenshot's left glyph.
- Tighter typography: 13px primary line, 12px secondary line, both single-line with truncation.
- Inline color emphasis on the numbers only (strong/good/possible/collected), no badges.
- "Why these results?" sits on the far right as a quiet chevron link (always visible, not optional).
- Container: white card with `border border-virgilio-purple/20`, no gradient wash.

## 4. Tabs — restore the four content tabs

The tabs row above the table currently shows `All / Strong fit / Good / Possible / Collected / Saved` (a fit filter). That belongs on the toolbar above the rows. The actual tab strip should be:

```text
Candidates 107   Saved 4   Archived   ………………………………………   ✨ Chat with Gio
```

Restore the four-tab strip in `SourcingProjectView` (already wired) and remove the fit-segment buttons from the same row. The fit segments stay only inside `CandidatesToolbar` as the inline filter chips ("All 107 · Strong fit 28 · Good · Possible · New · Saved").

## 5. Pagination — "Load 25 more" button

Replace the current full-list render with a client-side page size of 25:

- `SourcingCandidateTable` keeps a `visibleCount` state, default 25, step +25.
- Renders `candidates.slice(0, visibleCount)`.
- Below the last row, if `visibleCount < total`, show a centered `Button variant="secondary" iconRight={ChevronDown}` labeled `Load 25 more`.
- The toolbar's `Showing 1–25 of 107` label reads from the same `visibleCount`.
- Selection state keys by candidate id so loaded-but-unselected rows are unaffected.

## Files touched

- `src/components/sourcing/SourcingProjectHeader.tsx` — rebuild header row (saved-search selector, status pill, refresh, share, ellipsis).
- `src/components/sourcing/CandidatesBulkBar.tsx` — fix on-dark text colors.
- `src/components/sourcing/ResultsRunSummary.tsx` — restyle banner per spec.
- `src/components/sourcing/SourcingProjectView.tsx` — keep four-tab strip, drop fit segments from this row.
- `src/components/sourcing/CandidatesToolbar.tsx` — keep fit chips here only.
- `src/components/sourcing/SourcingCandidateTable.tsx` — add `visibleCount` paging + `Load 25 more` footer; surface count to toolbar.

## Out of scope

- No backend, no query, no scoring changes.
- Saved/Archived/Chat tabs' internals stay as-is.
- The Find page chrome (sidebar, top page header) stays as-is.

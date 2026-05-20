# Find — widen central column so the composer footer fits on one line

The empty-state canvas in `FindEmptyState.tsx` constrains its inner column to `max-w-[680px]`. The new composer footer (`Attach JD` · `Paste LinkedIn URL` · `Use an open job` + `⌘+Enter` + purple `Find candidates →`) is wider than 680px once you account for chip padding and the primary button, so the three quick-action chips wrap to a second line.

The reference screenshot shows them sitting on a single row, with everything (headline, subcopy, composer, info banner, starting points, saved searches) reading as a noticeably wider centered column — roughly 820–840px.

## Change

- `src/components/sourcing/FindEmptyState.tsx` — bump the central wrapper from `max-w-[680px]` to `max-w-[820px]`.
- No other layout changes. Hero text, info banner, 2×2 starting-point grid, and saved-search chip row all benefit from the extra width and stay visually balanced.

## Safety check

- The chip footer renders at ~700–720px on a 1313-wide viewport, comfortably inside 820px.
- The 2-column starting-point grid stays 2-up (each card ≥ ~400px wide, still fine).
- Saved-search chips already wrap naturally — wider container just means more per row.
- Sidebar width is unchanged, so the main canvas still has room for an 820px centered column with healthy gutters.

## Out of scope

- Composer internals (already correct).
- Sidebar, page header, info banner styling.

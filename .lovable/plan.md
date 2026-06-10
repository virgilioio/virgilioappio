## Problem

The canonical `<EmptyState size="card" />` renders a white card with no `max-width` and no horizontal centering. Where it sits matters:

- **Candidates page** — wrapped in `flex items-center justify-center`, so the card shrinks to its intrinsic content width. Looks correct (tight card hugging the illustration + copy).
- **Jobs page** (and every other table that uses `TableEmpty` / inlines the empty inside `<TableCell colSpan={N}>`) — the parent is a normal table cell, so the card stretches edge-to-edge of the table. Looks like a giant empty plate.

Same component, two very different shapes depending on parent. The Candidates treatment is the design intent.

## Fix — one change, in the primitive

Update `CanonicalEmptyState` in `src/components/ui/empty-state.tsx` so the `size="card"` card is **always** centered and width-capped, regardless of parent.

Add to the card's inline style when `size === 'card'`:

- `maxWidth: 480` (matches the Candidates "tight card" feel — wide enough for two lines of body + dual CTAs, narrow enough to read as a card and not a banner)
- `marginInline: 'auto'` (centers inside any block parent, including `<TableCell>`)
- `width: '100%'` (so it still fills narrow containers gracefully on mobile)

`size="route"` is left alone — route-level empties (full pages) keep their current sizing.

## Why this and not per-site fixes

- One source of truth. The 20+ call sites that use `size="card"` inside table cells (`TableEmpty`, `TableFilteredEmpty`, `JobsTable`, `OrganizationsTable`, `MembersTable`, `SourcingCandidateTable`, `CandidatesTable`, `DepartmentsManager`, `JobStagesTable`, `InvoiceHistoryTable`, `SaaSCustomersList`, `SearchResultsDialog`, …) all start matching the Candidates treatment automatically.
- Candidates already wraps in `flex justify-center`, so adding `marginInline: auto` is a no-op there — its appearance does not change.
- No visual change to `size="route"` empties (Talent Intelligence, dashboards, etc.).

## Files changed

- `src/components/ui/empty-state.tsx` — `CanonicalEmptyState` style block only.

## Verification

- `/jobs` with zero jobs and with a non-matching search: card is compact, centered in the table, not edge-to-edge.
- `/candidates` empty + no-match states: visually unchanged (still a tight centered card).
- Spot-check `/organizations`, `/members`, `/settings/departments`, sourcing project with no results: all tighten to the same compact centered card.
- Mobile width (375px): card hits `width: 100%`, sits flush with normal padding, no overflow.

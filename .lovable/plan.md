## Goal

Expand the **Amount** filter on the CRM → Deals board from `Total | Weighted` to `Total | Weighted | Collected | Outstanding`. The selected mode drives both the per-card amount and the per-stage subtotal. No schema changes — all data already exists in `deal_payments` (used by the Deal detail sheet's KPI strip).

## Behavior per mode

- **Total** (default, unchanged): `deal.amount` (base-currency converted, as today).
- **Weighted** (unchanged): `deal.amount × stage.probability`.
- **Collected**: sum of `deal_payments` where `status = 'paid'` for that deal, in workspace base currency (uses `base_amount` when present, same rule as the existing `useDealPaymentsTotals` hook).
- **Outstanding**: `max(0, Total − Collected)`.

Stage subtotal = sum of the per-card value under the selected mode.

Empty / zero handling: cards with no payments show `—` (not `0`) under Collected; Outstanding shows the full Total when nothing is collected; Total/Weighted behavior is unchanged.

## UI

- `AMOUNT_MODE_OPTIONS` in `src/pages/Deals.tsx` gains two entries: `{ value: 'collected', label: 'Collected' }`, `{ value: 'outstanding', label: 'Outstanding' }`.
- The existing `FilterChipSelect` chip already renders the label inline (e.g. "Amount | Collected") — no visual rework needed.
- Card amount label stays the same; only the number swaps. No new badge or pill.

## Technical notes

- `DealAmountMode` (in `src/components/deals/DealsKanbanBoard.tsx`) widens to `'total' | 'weighted' | 'collected' | 'outstanding'`.
- `DealsKanbanBoard` accepts a new optional prop `collectedByDeal: Map<string, number>` (already produced by `useDealPaymentsTotals`, which the page can call once).
- `computeDisplayAmount(deal, mode, collectedByDeal)` returns:
  - `total` → `deal.amount`
  - `weighted` → `deal.amount × (stage.probability ?? 0) / 100` (current logic preserved)
  - `collected` → `collectedByDeal.get(deal.id) ?? 0`
  - `outstanding` → `max(0, (deal.amount ?? 0) − (collectedByDeal.get(deal.id) ?? 0))`
- `stageSubtotal` re-uses the same function, so totals stay consistent with cards.
- `DealCard` keeps its `displayAmount` prop unchanged; only the parent computation changes.
- Persistence: the existing `usePersistentFilters` slot for `amountMode` already serializes the string value, so the new options round-trip without extra work.

## Files touched

- `src/pages/Deals.tsx` — add the two options, call `useDealPaymentsTotals`, pass `collectedByDeal` into the board.
- `src/components/deals/DealsKanbanBoard.tsx` — widen `DealAmountMode`, accept `collectedByDeal`, update `computeDisplayAmount` + `stageSubtotal`.

No DB migration, no edge function, no changes to `DealProfileSheet` or `DealCard` internals.

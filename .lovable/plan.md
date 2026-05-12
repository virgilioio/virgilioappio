## Goal

Add a 3-way amount mode selector on the Deals board that switches what every deal card's amount badge and every column total display:

- **Total** (current behavior — `deal.amount`)
- **Collected** (sum of `deal_payments` for that deal)
- **Outstanding** (`amount − collected`, floored at 0)

## UX

- Chip group rendered above the kanban (in `Deals.tsx`, between `PageHeader` and `DealsKanbanBoard`), aligned left.
- Single-select segmented chips: **Total · Collected · Outstanding**, default **Total**.
- Visual: reuse the same rounded-pill segmented look used by the ATS view switcher in `PipelineOverview.tsx` (`!rounded-full`, active = `bg-foreground text-background`, inactive = `text-text-secondary`). Inline `Button`s with `variant="ghost"` inside a `flex gap-1` row — no popover (this is a view mode, not a filter list).
- State lives in `Deals.tsx` (`amountMode: 'total' | 'collected' | 'outstanding'`) and is passed into `DealsKanbanBoard` as a prop.

## Data

New hook `useDealPaymentsTotals()` in `src/hooks/useDealPaymentsTotals.ts`:
- Single tenant-scoped query: `select deal_id, amount, currency from deal_payments` filtered by `tenant_id` (resolved from `members` like the existing hooks).
- Returns `{ collectedByDeal: Map<dealId, number> }` (sum per deal). Currency assumed to match the deal's currency (already enforced when registering payments).
- React Query keyed `['deal-payments-totals', tenantId]`. Invalidated by `useDealPayments` mutations — extend its `onSuccess` to also invalidate this key.

## Wiring

**`DealsKanbanBoard.tsx`**
- Accept new prop `amountMode`.
- Call `useDealPaymentsTotals()` once.
- Helper `displayAmount(deal)` → returns the number to show based on `amountMode`:
  - `total` → `deal.amount`
  - `collected` → `collectedByDeal.get(deal.id) ?? 0`
  - `outstanding` → `Math.max(0, (deal.amount ?? 0) − (collectedByDeal.get(deal.id) ?? 0))`
- Update `formatStageTotal` to take `(deals, amountMode, collectedByDeal)` and sum the displayed amount per currency.
- Pass `displayAmount(deal)` and `amountMode` into `DealCard` via two new optional props (`displayAmount?: number | null`, `amountLabelPrefix?: string` like "Collected: ").

**`DealCard.tsx`**
- If `displayAmount` prop is provided, use it instead of `deal.amount`; prepend the label prefix ("Collected", "Outstanding") to the badge to keep context clear.
- When prop is omitted, fall back to current `deal.amount` (no behavior change for any other consumer).

## Files

- Edit: `src/pages/Deals.tsx` — add chip group + state.
- Edit: `src/components/deals/DealsKanbanBoard.tsx` — accept `amountMode`, fetch totals, swap card amount + column total.
- Edit: `src/components/deals/DealCard.tsx` — optional `displayAmount` + `amountLabelPrefix` props.
- New: `src/hooks/useDealPaymentsTotals.ts`.
- Edit: `src/hooks/useDealPayments.ts` — invalidate `['deal-payments-totals']` on create/update/remove so column totals stay in sync.

## Out of scope

- No multi-currency conversion (existing card already shows per-deal currency).
- No DB schema changes; no new migrations.
- No changes to the deal profile sheet's billing tab (already shows the same numbers).

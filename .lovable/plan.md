# Fix Deal Card currency mismatch in CRM Kanban

## Problem
On `CRM > Deals` kanban, each deal card's main amount badge shows the **converted (base) amount** but labels it with the deal's **original currency code/symbol**. Example: a $15,000 USD deal in an MXN workspace renders the MXN-converted number with a "$ … USD" label.

## Root cause
`DealsKanbanBoard.computeDisplayAmount` returns `deal.base_amount ?? deal.amount` (always converted when available), but `DealCard` formats that number using `deal.currency` / `CURRENCY_SYMBOLS[deal.currency]`. The currency used to format never follows the value being shown.

## Fix (frontend only)

1. **`src/components/deals/DealsKanbanBoard.tsx`**
   - Pass the currency that matches `displayAmount` down to `DealCard` via a new `displayCurrency` prop. When `base_amount` is used, pass `base_currency`; otherwise pass `deal.currency`.
   - Apply this for both the column cards and the drag-overlay card.

2. **`src/components/deals/DealCard.tsx`**
   - Accept optional `displayCurrency?: string`. Use it (falling back to `deal.currency`) when building the amount badge label (both the symbol and the trailing currency code).
   - When `displayCurrency` equals `deal.base_currency` and differs from `deal.currency`, hide the redundant "≈ base amount" sub-line (the badge already shows the converted value in the base currency). Keep the sub-line behavior unchanged otherwise.

3. **No backend, hook, or schema changes.** `formatStageTotal` already formats stage totals in base currency correctly — leave it alone.

## Verification
- Create/open a deal in a non-base currency on an MXN workspace: the card's main badge should now read e.g. `$270,000 MXN` (converted), not `$270,000 USD`.
- Deals already in the base currency are unchanged.
- Stage column totals are unchanged.

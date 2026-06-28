## Redefine "Outstanding" metric

### New definition
**Outstanding = Σ (deal.base_amount − Σ paid_payments_on_deal)** across all deals where:
- `stage_type !== 'lost'` AND `lost_at IS NULL` (exclude Closed Lost)
- Includes both Open deals and Closed Won deals
- Deals with **no payment records at all** contribute their **full `base_amount`**
- Deals with partial payments contribute the remaining balance
- Negative diffs (overpaid) are clamped to 0
- All amounts normalized to the tenant's base currency

### Why this differs from today
Today, Outstanding only counts deals that already have at least one row in `deal_payments`. A Won deal with no payment schedule yet shows as $0 outstanding — wrong. Lost deals with scheduled-but-unpaid payments leak in — also wrong.

### Changes (frontend-only, no DB)

**File: `src/hooks/analytics/useCrmAnalyticsMetrics.ts`**

1. In `computeValues` (lines ~211–227), rewrite the Outstanding loop:
   - Iterate over **all enriched deals** (not just `dealTotals` map).
   - Skip a deal if `stage_type === 'lost'` OR `lost_at` is set.
   - Compute `dealBase = toBase(deal, tenantBase)`.
   - Compute `paidAmt = paidByDeal.get(deal.id) ?? 0` (lifetime paid).
   - Add `max(0, dealBase − paidAmt)` to outstanding.

2. Remove the now-unused `dealsWithBilling` / `dealTotals` gating around line 406–414 (or keep `dealTotals` only if still referenced — verify and drop if dead).

3. `computeValues` signature: `dealTotals` parameter becomes unnecessary for the outstanding calc. Either drop the parameter or ignore it. Keep the signature stable if other callers rely on it; just stop using it inside the outstanding block.

### Unchanged
- Collected, Revenue Won, Open Pipeline, Open Deals, Win Rate, etc. — no changes.
- Date range still does not filter Outstanding (it remains a current snapshot).
- Currency normalization via existing `toBase` helper.

### Verification
- Manually confirm in the Analytics page that a known Won deal with no payments now contributes its full amount; a Lost deal contributes 0; an Open deal with partial payment contributes the remainder.

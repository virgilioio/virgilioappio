# Fix CRM analytics totals (Revenue won and friends)

## What's actually wrong

I pulled your workspace data. Tenant base currency is **MXN**. Out of 18 deals:

- **2 deals** have `base_amount = NULL` (never recomputed since base currency changes / older records).
- **1 deal** has `base_currency = 'USD'` while the workspace is MXN — its stored `base_amount` is in the wrong currency.
- Of the 6 **won** deals, one (the 30,000 MXN "Administrador General") has NULL `base_amount`, so it contributes **0** to Revenue Won. Current displayed sum: 323,022 MXN. True sum: ~353,022 MXN.

Same pattern exists in `deal_payments` (2 rows null, 1 row in USD vs MXN base). So Collected / Outstanding can drift too.

Root causes in `useCrmAnalyticsMetrics.ts`:

1. `Number(d.base_amount ?? 0)` silently turns missing values into zero — no fallback to `amount` or `fx_rate`.
2. The hook trusts `deal.base_amount` is already in the workspace base currency. It never checks `deal.base_currency` against `baseCurrency`. Stale rows are summed as-is, mixing currencies.
3. Same two issues apply to `deal_payments` rows.

## Plan

### 1. Backfill stale base amounts (DB migration)

- Run a one-shot SQL update that recomputes `base_amount` / `base_currency` for every deal and payment where they are NULL or where `base_currency` ≠ the tenant's `settings->>'base_currency'`. Use the existing `recompute_open_deals_base` function if it covers won/lost too; otherwise extend it (new SQL function `recompute_all_deal_bases(p_tenant_id)`) that converts via the latest `currency_rates`/`currency_rate_overrides` and also walks `deal_payments`.
- Add a trigger on `tenants.settings` updates so changing base currency recomputes both `deals` and `deal_payments` going forward (today only deals are recomputed).
- Add a trigger on `deal_payments` insert/update mirroring the deal FX logic so new payments never land with NULL base values.

### 2. Defensive client-side normalization (`src/hooks/analytics/useCrmAnalyticsMetrics.ts`)

- Pull `currency`, `base_currency`, `fx_rate` for both `deals` and `deal_payments`.
- Add a `toBase(row, tenantBaseCurrency, rates)` helper:
  - If `row.base_currency === tenantBaseCurrency` and `row.base_amount != null` → use it.
  - Else if `row.currency === tenantBaseCurrency` → use `row.amount`.
  - Else convert `row.amount` using a rate from a small `currency_rates` lookup the hook fetches once per session (already used elsewhere). Cache by `${from}-${to}`.
- Replace every `Number(x.base_amount ?? 0)` in `computeValues`, `buildBreakdown`, and the daily trend with `toBase(x, baseCurrency, rates)`.
- Same treatment in the breakdown builders so stage/owner/company/source totals match the KPI cards.

### 3. Audit the other metric paths

- **Open pipeline / Open deals** — currently uses `base_amount`; same fix via `toBase`.
- **Collected / Outstanding** — apply `toBase` to `deal_payments` rows; recompute `dealTotals` with the same helper so Outstanding (deal total − collected) is consistent.
- **Avg deal size / Win rate / Sales cycle** — already derived from the corrected sums and counts, so they auto-correct.
- **Trend** — pass through `toBase` for `revenueWon`, `collected`.
- **Recruiting metrics** (applications, hires, etc.) are unrelated; verify by reading current values for the same range and confirming no regression after the refactor.

### 4. Verification

- Re-open Analytics with the wide Jan 2026 → today range and confirm the Revenue Won KPI matches `SELECT SUM(...)` from the DB to the cent.
- Spot-check Open pipeline, Collected, Outstanding, Avg deal size, and the stage breakdown total equals the KPI.
- Manual SQL parity check script in `scripts/check_crm_totals.sql` (read-only) for future regressions.

## Files touched

- `supabase/migrations/<ts>_crm_recompute_base_amounts.sql` — backfill + trigger.
- `src/hooks/analytics/useCrmAnalyticsMetrics.ts` — `toBase` helper + use it everywhere; fetch FX table once.
- `src/hooks/analytics/__tests__/` (optional) — unit test for `toBase` mixed-currency aggregation.
- `scripts/check_crm_totals.sql` — parity checker.

## Out of scope

- Visual / layout changes to widgets.
- Recruiting KPI logic (only verified for non-regression).

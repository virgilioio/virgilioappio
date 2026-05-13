# Multi-Currency Deals & Payments

## Goal
Let deals and payments be recorded in any currency the client actually pays in (USD, MXN, EUR, …) while every total, kanban column, and report rolls up in **one workspace base currency** using accurate, dated FX rates.

Note: `deal_invoices` is a file-upload table (no amount/currency), so the financial scope here is **deals + deal_payments**.

---

## Architecture at a glance

```text
Settings → Workspace → Base currency (e.g. USD)
                │
                ▼
   ┌──────────────────────────┐        ┌────────────────────────┐
   │ currency_rates (daily)   │◀──────▶│ Edge fn: refresh-fx    │
   │  base, quote, rate, date │  cron  │ (Frankfurter/ECB)      │
   └────────────┬─────────────┘        └────────────────────────┘
                │ lookup at write time
                ▼
   deals.amount + currency           ← original (source of truth)
   deals.base_amount + base_currency ← live snapshot, recomputed daily for OPEN deals
   deals.fx_rate + fx_rate_date

   deal_payments.amount + currency           ← original
   deal_payments.base_amount + base_currency ← FROZEN at payment date
   deal_payments.fx_rate + fx_rate_date
   deal_payments.fx_rate_source ('auto' | 'manual')
```

**Rules**
- Original `amount` + `currency` are **immutable** for accounting integrity.
- `base_*` columns are derived; recomputable from rate tables.
- Payments freeze their FX rate at creation (ledger style — actual revenue collected).
- Open deals recompute `base_amount` daily from current rate; once a deal stage is marked **won/closed**, the rate freezes too.
- Admin can override any rate from Settings; override wins over auto feed and is timestamped + attributed.

---

## Workstreams

### 1. Settings — Base currency & FX management
New section in **Settings → Workspace → Currency**:
- Pick **Base currency** (default USD). Stored on `tenants.settings.base_currency`. Changing it triggers a one-time backfill confirmation modal (see §6).
- **Active currencies** chip list — currencies enabled for selection in deal/payment forms (limits clutter).
- **Today's rates** table: base → each active currency, last refreshed timestamp, source badge (Auto / Manual).
- Per-row **Override rate** action (modal: rate, optional expiry date, note). Manual rate persists until expiry or removal.
- Manual **Refresh now** button.

### 2. Database
New tables + columns (single migration):

`currency_rates`
- `tenant_id`, `base_currency`, `quote_currency`, `rate numeric(18,8)`, `rate_date date`, `source text` ('auto'|'manual'), `created_by`, `created_at`
- Unique `(tenant_id, base_currency, quote_currency, rate_date, source)`
- RLS: tenant-scoped read; admins write.

`currency_rate_overrides` (active manual overrides)
- `tenant_id`, `base_currency`, `quote_currency`, `rate`, `effective_from`, `effective_to nullable`, `note`, `created_by`
- Lookup priority: active override → most recent auto rate ≤ date.

Alter `deals`:
- `base_currency text`, `base_amount numeric`, `fx_rate numeric(18,8)`, `fx_rate_date date`, `fx_locked_at timestamptz nullable`

Alter `deal_payments`:
- `base_currency text`, `base_amount numeric`, `fx_rate numeric(18,8)`, `fx_rate_date date`, `fx_rate_source text`

DB function `convert_to_base(p_tenant_id, p_amount, p_currency, p_date)` returns `(base_amount, rate, rate_date, source)` — single source of truth used by triggers and edge functions. Returns NULL gracefully if no rate available (UI shows "Rate pending").

### 3. Rate refresh edge function
`refresh-fx-rates` (scheduled daily 06:00 UTC via `pg_cron` + `pg_net`):
- Pulls EUR-quoted rates from Frankfurter (free, ECB-backed, no API key).
- Cross-rates derived for each tenant's base currency.
- Inserts one row per `(tenant, base, quote)` per day with `source='auto'`.
- Idempotent on `(tenant, base, quote, date, source)`.
- Manual "Refresh now" button calls same function on demand.

### 4. Deal & Payment write paths
On insert/update of `deals.amount|currency` (open deal): trigger calls `convert_to_base()`, fills `base_*`. When a deal moves to a **won/closed** stage, `fx_locked_at = now()` and base_amount is no longer recomputed.

On insert of `deal_payments`: trigger fills `base_*` from rate at `payment date` and **never** recomputes after.

Daily cron job `recompute-open-deals-base` re-runs `convert_to_base()` for all deals where `fx_locked_at IS NULL`. Keeps forecast totals fresh.

### 5. UI changes
**Deal cards (kanban)**
- Show original: `MX$170,000 MXN`.
- Tiny muted line below for non-base currencies: `≈ $9,800` (base). Skipped if currency == base.

**Column headers / board totals**
- Always sum `base_amount`. Tooltip: "Converted at today's rate; payments at their dated rate."

**Filter chip "Amount" (Total/Collected/Outstanding)**
- All three computed in base currency. No user toggle (per your decision).

**Deal profile**
- `DealBillingSummary` shows base totals, with a small expandable breakdown: per-currency subtotals (e.g. "USD $4,500 · MXN MX$85,000").
- Payment list shows `original (≈ base)` per row.

**Forms**
- Deal form: currency selector defaults to last-used or base. Live converted preview under the amount input.
- Payment form: same, plus a read-only "Rate used: 1 USD = 17.32 MXN (auto · today)".

**Settings warning banner**
- If a deal/payment has `base_amount IS NULL` (no rate available), show a one-line alert linking to Settings.

### 6. Changing base currency
One-time guarded action:
- Modal: "This re-expresses every deal & payment total in {NEW}. Original amounts and historic payment rates are preserved."
- Backfill job recomputes `deals.base_*` for open deals (live rate) and rewrites `base_currency` label on closed deals/payments by re-converting via cross-rate at their original `fx_rate_date`. Original `amount`/`currency` untouched.

### 7. Hooks & front-end plumbing
- New `useBaseCurrency()` (reference cache tier).
- New `useCurrencyRates()` (reference tier, 10 min).
- `useDeals` / `useDealPayments` / `useDealPaymentsTotals` updated to read `base_amount` for aggregations; cards still get `amount`+`currency` for display.
- `formatMoney(amount, currency)` helper centralising `CURRENCY_SYMBOLS` usage (replaces ad-hoc `fmt()` in `DealBillingSummary`).

### 8. Permissions
- Viewing rates & converted totals: any CRM user.
- Editing base currency / manual overrides: workspace admins + Sales role with admin grant (TBD — default admin-only).

---

## Out of scope (for this pass)
- Historical analytics charts beyond CRM (revenue dashboard etc.) — same pattern applies later.
- Multi-base reporting (looking at the same data in EUR and USD simultaneously).
- Per-organization base currency.

---

## Acceptance criteria
1. Admin sets base currency in Settings; rates auto-populate within minutes.
2. Creating a deal in MXN shows live `≈ USD` preview; saved deal contributes to USD column total.
3. Recording a payment in EUR locks the EUR→USD rate of that day forever; `Collected` stays stable across future rate moves.
4. Admin override of EUR→USD immediately changes open-deal totals; payment history unaffected.
5. Closed/won deals stop revaluing.
6. Changing base currency re-expresses all totals; original amounts untouched; audit trail preserved.

---

## Open questions before build
- **a.** Default base currency on existing workspaces — assume **USD** unless `tenants.settings` already has one?
- **b.** "Closed/won" stage detection — use a flag on `deal_stages` (`is_won boolean`) or rely on stage name? Current schema doesn't have this flag.
- **c.** Should a manual override apply to **only future writes** or also retroactively recompute today's open deals? (Recommend: recompute open deals immediately, leave payments alone.)

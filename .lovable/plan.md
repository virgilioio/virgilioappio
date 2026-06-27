
## Plan: CRM Analytics

Reuse the existing analytics engine (`src/components/analytics/model/*`, `WidgetFrame`, KPI cards, chart primitives, filter pills). No new chart styling, no fork. Money is consumed in already-converted base currency (`deals.base_amount`, `deal_payments.base_amount`) — no FX logic.

### 1. Database (additive only)

One migration:
- `ALTER TABLE public.deals ADD COLUMN IF NOT EXISTS source text;` (values: `referral`, `inbound`, `outbound`, `repeat_client`, `partner`, plus null).
- Index `deals(tenant_id, won_at)`, `deals(tenant_id, created_at)`, `deals(tenant_id, stage_id)`, `deal_payments(tenant_id, paid_at)` for fast aggregation.

No CHECK constraint (per memory rules). No backfill.

### 2. CRM data hook — `src/hooks/analytics/useCrmAnalyticsMetrics.ts`

Single hook that fetches once per (tenant, dateRange, filters) and returns:
- `openPipeline`, `revenueWon`, `openDeals`, `dealsWon`, `winRate`, `avgSalesCycleDays`, `avgDealSize`, `collected`, `outstanding`, `newDeals` (all scalars).
- `trend`: daily series `{date, revenueWon, newDeals, collected}` for the range (and previous-period equivalent for delta).
- `breakdownByStage`, `breakdownByOwner`, `breakdownByCompany`, `breakdownBySource` for each measure.
- `previous` block (same shape, previous equal-length period) so the engine can compute deltas.

All money fields use `base_amount`. Sales cycle = `won_at - created_at` (days). Filters: owner ids, company ids, stage ids, date range.

### 3. Extend analytics model

- `model/types.ts`: extend `MetricId` with `open_pipeline | revenue_won | open_deals | deals_won | win_rate | avg_sales_cycle | avg_deal_size | collected | outstanding | new_deals`. Extend `DimensionId` with `deal_stage | deal_owner | company | deal_source`. Add `Format` values `'money' | 'ratio'` (or reuse `pct`; add `'money'`). Add `Tone` `'amber'` already exists.
- `model/metrics.ts`: register the 10 CRM metrics with tones/icons/format/deltaGood per spec.
- `model/dimensions.ts`: add the 4 CRM dimensions (`deal_stage` funnel-capable).
- `model/viz.ts`: extend `vizFor` for new dims (stage→funnel/bars/columns/donut/table; owner/company→bars/table; source→bars/columns/donut/table).
- `model/format.ts`: add money formatter using tenant base currency code from `useTenant`.
- `AnalyticsDataContext.tsx`: add `crm: useCrmAnalyticsMetrics(...)` to the bundle.
- `useWidgetData.ts`: extend switch for each new metric (value, time series, sparkline, breakdowns). Pull base-currency symbol for display only.

The Analytics page automatically gains the CRM metrics/dimensions in the existing widget builder dropdowns. Group them visually with a "CRM" heading in `WidgetFrame.tsx`'s `Dropdown` (lightweight `optgroup`).

### 4. CRM Overview page

- New file `src/pages/CrmOverview.tsx` — curated, read-only.
- Route changes in `src/App.tsx`:
  - `/crm` → renders `<CrmOverview/>` (landing).
  - `/crm/companies` → renders existing companies page (formerly at `/crm`).
  - Old `/crm/companies/:id` stays.
- Header tab in `src/components/layout/Header.tsx`: add Overview (icon `PieChart`) first, then Companies (`/crm/companies`), then Deals. Mark `getActiveSection` already routes `/crm/*` to `crm`.

Layout (mirrors mock):
- Header: eyebrow optional, `Overview.` h1 with lilac period, meta line `{N} open deals · {pipeline} in pipeline · {range label}`, right-side "Full report in Analytics →" button → `navigate('/analytics')`.
- Filter bar reusing `AnalyticsFiltersToolbar` patterns but slimmed: Owner / Company / Stage pills + Date range pill (default "This quarter": last30 / last90 / this quarter / this year). Active filter count badge on Filters label, Clear when any active.
- Widgets, fixed, no configure/drag: render 4 KPI `WidgetFrame`s (Open pipeline / Revenue won / Win rate / Avg sales cycle) + 2 chart `WidgetFrame`s (Open pipeline by stage funnel; Revenue won over time line). Pass `readonly` prop to suppress the toolbar.
- Bottom dashed banner: "See win rate, sales cycle, collections & owner breakdowns in Analytics →" — links to `/analytics`.

Make `WidgetFrame` accept `readonly?: boolean` to hide the toolbar (drag/resize/config/remove) — simplest reuse path.

### 5. Filters wiring

`PageFilters` extended with `dealOwnerIds`, `dealCompanyIds`, `dealStageIds`. Existing ATS filters stay untouched. `useCrmAnalyticsMetrics` reads only the CRM filter slice. On Analytics page these new filter dimensions appear alongside existing ones (extend `AnalyticsFiltersToolbar` to include owner/company/stage selectors that map onto either ATS or CRM filters — but to keep scope tight, the global filters already cover Owner (recruiter==deal owner), Company (organization==company); Stage will be a new pill.

### 6. Reconciliation

Deals Won/Revenue Won come from the same `deals` rows used by Deals board (`won_at`, `base_amount`). ATS Hires read from `job_candidate_associations`. They're not double-counted; they describe different events. Document inline in `useCrmAnalyticsMetrics.ts` that CRM "Deals won" is the canonical source for revenue events.

### Out of scope (per spec)
- Currency conversion, FX, rate storage.
- Seeded Analytics dashboards or CRM-only views.
- New chart styling.

### Files touched
- New: migration, `src/hooks/analytics/useCrmAnalyticsMetrics.ts`, `src/pages/CrmOverview.tsx`.
- Edited: `src/App.tsx`, `src/components/layout/Header.tsx`, `src/components/analytics/model/{types,metrics,dimensions,viz,format,AnalyticsDataContext,useWidgetData}.ts(x)`, `src/components/analytics/widgets/WidgetFrame.tsx` (readonly + metric optgroup).

Confirm and I'll ship it.

## Goal
Make every CRM widget metric (`Revenue won`, `Deals won`, `Win rate`, `Avg sales cycle`, `Avg deal size`, `Open pipeline`, `Open deals`, `Collected`, `Outstanding`, `New deals`) reflect the actual state of CRM deals.

## What I found
All ten CRM metrics are wired correctly in the analytics bundle and widget data layer. The root cause is in the database: deals already sitting in a canonical `Won` stage have `won_at = null`, and deals in `Lost` have `lost_at = null`. Because every CRM metric (except `New deals`) is derived from `won_at` / `lost_at` / `deal_payments`, almost nothing shows up.

Concretely:
- `Revenue won`, `Deals won`, `Win rate`, `Avg sales cycle`, `Avg deal size` all key off `won_at`. → currently 0.
- `Open pipeline`, `Open deals` treat a deal as open when `won_at` and `lost_at` are both null. → Won deals are wrongly counted as Open.
- `Collected`, `Outstanding` depend on `deal_payments`. They only need data if payments exist; if no payments are logged they will correctly show 0.
- `New deals` keys off `created_at` and the active date range; this one works if the range covers the deal's creation date.

## Plan

1. **Add a database trigger on `deals` to keep terminal timestamps in sync with `stage_type`**
   - On insert and on stage change:
     - If new stage is `won` and `won_at` is null → set `won_at = now()`, clear `lost_at` / `lost_reason`.
     - If new stage is `lost` and `lost_at` is null → set `lost_at = now()`, clear `won_at`.
     - If new stage is `open` → clear both `won_at` and `lost_at`.
   - This guarantees future moves (drag-and-drop on the board, edits in the sheet, any new client) always populate the close markers, even if a developer forgets.

2. **Backfill existing CRM data**
   - Set `won_at` for every deal currently in a Won stage (using `updated_at` as the best available timestamp).
   - Set `lost_at` for every deal currently in a Lost stage (same approach).
   - This immediately repairs `Revenue won`, `Deals won`, `Win rate`, `Avg sales cycle`, `Avg deal size`, `Open pipeline`, `Open deals` for existing tenants.

3. **Frontend cleanup (small)**
   - In `useDeals.moveDeal`, also invalidate analytics caches so widgets refresh immediately after a deal is dragged to Won/Lost on the kanban.

4. **Validation**
   - Re-query Won and Lost deals and confirm `won_at` / `lost_at` are populated.
   - Open Analytics and verify CRM metrics return non-zero values for date ranges covering those dates.

## Notes
- `Collected` and `Outstanding` will only have data if the user records payments in `deal_payments`. If they expect those to show value purely from deal totals, that is a separate product decision and I will flag it after this fix lands.
- No metric definitions change; this is a data-correctness fix, not a metric redesign.
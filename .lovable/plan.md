# Consolidate Won & Lost as system deal stages

## Diagnosis

The CRM analytics widgets ARE wired to live CRM data. `useCrmAnalyticsMetrics` reads `deals.base_amount` and filters by `won_at` / `lost_at` inside the active date range, broken down by `deal_stages.stage_type` (`open` / `won` / `lost`).

Your "Revenue won" widget shows "No data" because the deal you created hasn't been moved to a stage whose `stage_type = 'won'` — without that, the DB trigger never sets `won_at`, so it can't roll up.

The deeper issue you flagged is real: `Won` and `Lost` are seeded as defaults on first use (via `ensure_default_deal_stages`), but afterwards they behave like any other tenant-created stage — they can be renamed, retyped, or deleted. If a tenant deletes "Won", analytics silently break with no recovery path. Every mature CRM treats Won/Lost as canonical, non-removable stages.

## What changes

### 1. Database migration — guarantee Won/Lost exist per tenant
- **Backfill**: for every existing tenant in `deal_stages`, ensure exactly one `stage_type='won'` and one `stage_type='lost'` row exists. Insert "Won" / "Lost" at the end of the list when missing.
- **Auto-provision on new tenants**: add a trigger so any new tenant that gets its first `deal_stages` row also gets a `won` + `lost` row (covers the case where stages are created outside `ensure_default_deal_stages`).
- **Protection trigger** on `deal_stages`:
  - `BEFORE DELETE`: block when the row is the last `won` or `lost` stage for the tenant. Raise a friendly error.
  - `BEFORE UPDATE`: block changing `stage_type` away from `won` / `lost` if it would leave the tenant with zero rows of that type.
- Add a boolean computed flag `is_system` exposed via a view OR simply detect on the client by `stage_type IN ('won','lost')` — no schema change needed.

### 2. UI — mark Won/Lost as system stages in Settings → Deal Stages
File: `src/components/settings/DealStagesManager.tsx`, `DraggableDealStageItem.tsx`
- Show a small "System" badge on rows where `stage_type` is `won` or `lost`.
- Hide the **Delete** action on those rows.
- Disable the **Stage type** select (rename allowed, retype not).
- Keep drag-to-reorder allowed.
- When the user attempts a blocked action (via API edge case), surface the trigger's error message in a toast.

### 3. UI — Deal board reassurance
File: `src/components/deals/DealsKanbanBoard.tsx`
- No logic change. Already keys on `stage_type`. Confirm that the seeded Won/Lost columns render with their distinctive colors (#12B886 / #EF4444 fallbacks already exist).

### 4. No analytics code change required
`useCrmAnalyticsMetrics` already keys on `stage_type`, not stage names. Once the structural guarantee is in place and the user moves a deal into the Won column, `won_at` is set by the existing DB trigger (`20260513174728_d4644d61...sql` line 182), `base_amount` populates from the currency-conversion trigger, and the widget will reflect it within the active date range.

## Out of scope

- Default Analytics date range changes (currently 7 days).
- Currency conversion behavior.
- Multiple Won/Lost stages per tenant (we enforce exactly-one for now; this matches every other CRM).

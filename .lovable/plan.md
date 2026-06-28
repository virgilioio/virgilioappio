## Goal

Guarantee that **Open pipeline** and **Open deals** — wherever they appear (Analytics widgets, Deals page KPI strip, Company detail KPI strip) — only count deals whose stage is `open`, never deals in a `won` or `lost` stage.

## Audit results

Current code already excludes won/lost in every surface, but each surface uses a different signal:

| Surface | File | Open signal |
|---|---|---|
| Deals page KPIs | `src/pages/Deals.tsx` (L69–77, 130) | `stage_type === 'open'` ✅ |
| Company detail KPIs | `src/pages/CompanyDetail.tsx` (L93–97) | `s.stage_type === 'open'` (treats unknown stage as open) ⚠️ |
| Analytics CRM bundle | `src/hooks/analytics/useCrmAnalyticsMetrics.ts` (L153, 257) | `!won_at && !lost_at` ✅ (depends on the DB trigger we shipped) |

A spot-check of the DB confirms data is currently consistent (every deal in a `won` stage has `won_at`; every deal in a `lost` stage has `lost_at`; open stages have neither). So the user is right that today it works, but it relies on a single source (timestamps) in Analytics and on a separate signal (stage_type) in the Deals/Company pages. Drift between the two is the failure mode we want to lock down.

## Changes (frontend-only, safety net)

1. **`useCrmAnalyticsMetrics.ts` — make "open" a two-key check**
   - In the query function, populate `stage_type` on each `DealRow` from the already-fetched `stages` array (build a `Map<stage_id, stage_type>`).
   - Change the `isOpen` check in `computeValues` and `buildBreakdown` from:
     ```ts
     const isOpen = !d.won_at && !d.lost_at
     ```
     to:
     ```ts
     const isOpen =
       d.stage_type !== 'won' &&
       d.stage_type !== 'lost' &&
       !d.won_at &&
       !d.lost_at
     ```
   - This means a deal sitting in a Won/Lost stage is excluded from Open even if `won_at`/`lost_at` haven't been written yet (e.g. legacy rows the trigger missed, or a future bulk import).

2. **`CompanyDetail.tsx` — tighten the fallback**
   - Replace `!s || s.stage_type === 'open'` with strict `s?.stage_type === 'open'`, so a deal with an unresolved stage is **not** silently bucketed as Open.

3. **No change** to `Deals.tsx` — its existing `stage_type === 'open'` filter is already correct.

4. **No DB / business-logic changes.** The existing `sync_deal_terminal_timestamps` trigger and backfill continue to keep the timestamps in sync; the frontend changes above are belt-and-suspenders so a missing timestamp can never leak a Won/Lost deal into Open.

## Verification

- Reload `/analytics`: Open pipeline / Open deals KPIs and the "Open deals by stage" funnel show zero contribution from Won/Lost stages.
- Move a deal from an Open stage → Won stage → back to Open on the Deals board and confirm the KPI strip and Analytics both update without ever counting it as Open while in Won/Lost.
- Open a company detail page and confirm Open deals count matches the Deals board for that company.

# Analytics → Configurable Widget Dashboard

Re-presentation of the existing 9 sections as a widget grid driven by a tiny config grammar `{ metric, groupBy, viz, scope, span }`. **All 9 section hooks are reused unchanged** — the new model normalizes their output into `{ value, format, series, trend }`. Only one schema change: `saved_views.visibility`.

Scope: `/analytics` only. `/insights` (Intelligence stub) is not touched.

---

## Phase 1 — Data layer (no new queries)

Create `src/components/analytics/model/`:

- `metrics.ts` — registry of 9 metrics (applications, active_candidates, hires, time_to_hire, interviews, interviews_scheduled, offers_sent, offer_acceptance, rejections). Each declares `{label, tone, icon, format, deltaGood, source}` where `source` names the hook + field it reads.
  - Canonical offers = `useOfferAnalyticsMetrics.offersSent` (drop `useAnalyticsMetrics.totalOffers` and Job Health offers — they double-count).
  - No `pass_rate` for v1.
- `dimensions.ts` — only the dimensions that exist today: `time, stage, job, recruiter, source, seniority, skills, experience, geography (country only — label "Country")`. **`department` omitted.**
- `viz.ts` — 7 viz primitives + `vizFor(groupKey)` whitelist (kpi/line/bars/columns/donut/funnel/table).
- `format.ts` — `fmt(v, format)` (count `toLocaleString`, days `Xd`, pct `X%`).
- `useWidgetData.ts` — single hook that takes a widget config, calls the right section hook(s) (already running at page level via context), and returns `{loading, value, series, trend, breakdown}` in the unified shape. Per-widget scope is applied by re-filtering the already-fetched arrays in JS — no extra Supabase calls.

A `AnalyticsDataContext` provider runs the 9 section hooks **once** with the page filters + date range and exposes their outputs; widgets read from context (avoids N parallel re-fetches).

## Phase 2 — Page chrome

`src/pages/Analytics.tsx` rewritten:

- Header: eyebrow "ANALYTICS", title "Recruiting analytics" with lilac `.`, meta line ("{n} widgets · Hover to configure…"), right actions = View switcher · Export (existing PDF) · purple "+ Add widget".
- **View switcher** (`AnalyticsViewSwitcher.tsx`) — wraps `useSavedViews('analytics')`, adds Shared/Private grouping, rename/duplicate/delete, Make shared/Make private toggle (writes new `visibility`).
- **Filter bar** (`AnalyticsFiltersToolbar.tsx`) — re-skinned reuse of existing logic from `AnalyticsFiltersBar`. Org filter relabeled **"Company"** (not Department). Date-range pill on the right (Today/7d/30d/90d/Quarter/Year, default 30d) and is now **persisted into the saved view**.

## Phase 3 — Widget + chart primitives

`src/components/analytics/widgets/`:

- `WidgetFrame.tsx` — card chrome, header (icon chip + auto-title + sub-line + scope chip), body slot, hover toolbar.
- `charts/Kpi.tsx`, `Line.tsx`, `Bars.tsx`, `Columns.tsx`, `Donut.tsx`, `Funnel.tsx`, `TableViz.tsx` — pure presentational, width-measured via ResizeObserver. Palette + tone→color map in `model/tokens.ts`.
- Each KPI uses **its own** trend series (fixes the duplicated-sparkline bug).

## Phase 4 — Inline editing (always-on)

- `WidgetHoverToolbar.tsx`: drag handle (grip-vertical), resize cycler (per-viz `allowedSpans`), configure (settings-2), remove (trash).
- `WidgetConfigPopover.tsx`: Metric · Split by · Visualization (gated by `vizFor`) · Scope this card. On groupBy change, if current viz invalid → auto-pick `vizFor(newGroup)[0]` and reset card scope. Auto-title rederived unless user customized.
- `AddWidgetTile.tsx`: dashed tile at grid end, appends `{applications, none, kpi, 3}` and opens config immediately.
- `EmptyView.tsx`: dashed panel with "Add your first widget".

## Phase 5 — Drag & drop (@dnd-kit, strict)

`WidgetGrid.tsx`:

- `<DndContext>` + `<SortableContext strategy={rectSortingStrategy}>`, `closestCenter`.
- Sensors: `PointerSensor` with `activationConstraint: { distance: 6 }` + KeyboardSensor.
- Each widget: `useSortable({id})`. `listeners` bound **only** to grip handle.
- `<DragOverlay>` for the floating copy (shadow + scale 1.02). Original slot → `opacity:0.4` + dashed lilac outline as drop placeholder.
- Reorder ONLY in `onDragEnd` via `arrayMove`. Persist layout to `saved_views.extra_state` on commit.
- Add-widget tile excluded from `SortableContext`. Respect `prefers-reduced-motion`.

## Phase 6 — Persistence, sharing, seeds, fixes

### Schema change (the only one)
Migration on `saved_views`:
- Add `visibility text not null default 'private' check (visibility in ('private','shared'))`.
- Update RLS SELECT: `user_id = auth.uid() OR (visibility='shared' AND tenant_id = current_user_tenant())`. UPDATE/DELETE remain owner-only.
- Index `(tenant_id, page_context, visibility)`.

### Persistence
- Layout (`widgets[]` with `{id, metric, groupBy, viz, span, scope?, title?}`) serialized into existing `extra_state` jsonb. **No new layout table.**
- Date range added into the persisted payload.
- `useSavedViews` extended for `visibility` + listing shared views from other users in the tenant.

### Seeds (idempotent per tenant)
On first load of `/analytics` in a tenant with no analytics views, insert:
1. **Recruiting Overview** — `visibility:'shared'`, `is_default:true`. 8 widgets per spec.
2. **Sourcing & Quality** — `visibility:'private'`. 8 widgets per spec.

### Must-fix data-quality bugs in REUSED hooks
- `useAnalyticsMetrics`: scope `activeCandidates` & `rejectedCandidates` to the date range; compute distinct trend series for active + scheduled (no more `appSparkData` reuse).
- `useStagePerformanceMetrics`: push date range into `job_candidate_stage_history` query for `avgTimePerStage`.
- `useSourcePerformanceMetrics` + `useTalentInsightsMetrics`: accept and apply `dateRange` on the association fetch.
- `useRecruiterPerformanceMetrics`: join through `members` → `profiles` to resolve names; never display UUID slices.
- `useJobHealthMetrics`: offers = `status='offer'` only (drop `|| offered_at`).
- `analyticsReportGenerator`: pass real `interviewsByStage`/`stageConversions` from `useStagePerformanceMetrics`.

### Fast-follow (NOT this pass, noted as TODO)
True department group-by, city-grain geography, DB-side aggregation + `keepPreviousData`.

---

## Files created / changed

**New**
- `src/components/analytics/model/{metrics,dimensions,viz,format,tokens}.ts`
- `src/components/analytics/model/AnalyticsDataContext.tsx`
- `src/components/analytics/model/useWidgetData.ts`
- `src/components/analytics/widgets/{WidgetFrame,WidgetHoverToolbar,WidgetConfigPopover,AddWidgetTile,EmptyView}.tsx`
- `src/components/analytics/widgets/charts/{Kpi,Line,Bars,Columns,Donut,Funnel,TableViz}.tsx`
- `src/components/analytics/WidgetGrid.tsx` (DnD)
- `src/components/analytics/AnalyticsViewSwitcher.tsx`
- `src/components/analytics/AnalyticsFiltersToolbar.tsx`
- `src/components/analytics/seedDefaultViews.ts`
- Migration: `saved_views.visibility` + RLS update

**Changed (REUSE — minimal edits only for the must-fix bugs above)**
- `src/pages/Analytics.tsx` — replace section render with `<AnalyticsDataProvider><WidgetGrid/></AnalyticsDataProvider>`. Sections deleted from this page.
- `src/hooks/useSavedViews.ts` — `visibility`, shared listing, typed `saved_views` row.
- `src/hooks/useAnalyticsMetrics.ts`, `src/hooks/analytics/useStagePerformanceMetrics.ts`, `useSourcePerformanceMetrics.ts`, `useTalentInsightsMetrics.ts`, `useRecruiterPerformanceMetrics.ts`, `useJobHealthMetrics.ts` — targeted bug fixes only.
- `src/utils/analyticsReportGenerator.ts` callsite — pass real stage data.

**Untouched**
- The 9 section components under `src/components/analytics/sections/` (no longer rendered on `/analytics`, kept in repo in case they're referenced elsewhere).
- `/insights` route and `AnalyticsHub.tsx`.
- All non-analytics code.

---

## Open questions before I build

1. **Old section components** under `src/components/analytics/sections/` — keep them dormant in the repo (safe), or delete? Default: keep.
2. **Shared views — who is "anyone with Analytics access"?** I'll scope to "any authenticated user in the same `tenant_id`" via the existing tenant lookup pattern. Confirm that matches your access model (no per-role gate beyond tenant).
3. **Seeding default views** — run a one-time client-side seeder when a tenant has zero analytics views (safe, idempotent via name+tenant uniqueness). OK, or do you want this server-side?

Reply with answers (or "go ahead") and I'll build the whole thing in one pass.
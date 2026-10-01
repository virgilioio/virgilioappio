# Job hygiene widgets: time in stage

## What you get
A new widget group, **Pipeline hygiene**, in the widget picker, built from real active candidates (rejected, hired and withdrawn are excluded). Each candidate's "days in stage" = today minus the day they entered their current stage.

Three new metrics:
1. **Avg days in stage** — the average across active candidates.
2. **Stuck candidates** — how many have sat in their current stage longer than a threshold (default 14 days; choose 7 / 14 / 30 / 60 in the widget settings).
3. **Days in pipeline** — days since the candidate was added to the job (answers "sitting at a specific job for a long time").

How each one can be shown:
- **Single number**: e.g. "12 stuck · 14d+".
- **Bars / table split by Stage**: avg days and stuck count per stage (Application review, Screening...). This answers "who is stuck in Application review".
- **Bars / table split by Job or Recruiter**: same, per job or per owner.
- **Aging buckets (new chart style, stacked bars)**: per stage or per job, candidates split into 0–7d, 8–14d, 15–30d, 30d+ (green to red). This is the usual "aging" chart for pipeline hygiene.
- **Stuck candidates list (table)**: candidate, job, stage, days in stage, sorted longest first; clicking a row opens the candidate in that job.

The period filter doesn't apply (these are "right now" snapshots); job, recruiter and job-status filters do. The picker will label them "Current snapshot".

A new **Pipeline hygiene** starter dashboard: stuck KPI, avg days in stage KPI, aging by stage, aging by job, stuck list. Saved dashboards stay unchanged.

## Data accuracy caveat
Only 5 of 201 active candidates have a saved stage move in history today, so for most candidates the stage-entry date isn't recorded. The first step is to check which saved date best reflects "entered current stage". Fallback order: last recorded stage move, then any stage-change date saved on the candidate's job record, then the date they were added to the job. Candidates on fallback dates are counted, and the widget shows a small "estimated for N candidates" note so the numbers stay honest. From now on every stage move is already recorded, so accuracy gets better over time.

## Technical details
- New hook `src/hooks/analytics/usePipelineAgingMetrics.ts`: active associations (tenant-scoped, chunked history lookup per the non-tenant query pattern), computes `daysInStage`, `daysInPipeline`, `estimated` flag; groups by stage (stage name and position order), job, recruiter; buckets.
- `types.ts`: MetricIds `avg_days_in_stage`, `stuck_candidates`, `days_in_pipeline`; MetricGroup `hygiene`; VizId `stacked_bars`; optional `threshold` on WidgetConfig.
- `metrics.ts`, `viz.ts`, `dimensions.ts`: register metrics, allow stage/job/recruiter splits, new viz.
- `AnalyticsDataContext.tsx` + `useWidgetData.ts`: wire the data source, ignore date range for snapshot metrics, return buckets/list rows.
- New `StackedBarsChart` and a list-mode table renderer following the Tables foundation (IdentityCell, NumericCell `Xd`).
- Widget editor: Hygiene group + threshold selector; `seedDefaultViews.ts`: "Pipeline hygiene" template.
- Verify against a DB query of current counts per stage before reporting.

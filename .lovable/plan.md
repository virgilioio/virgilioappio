

# Phase 1: Full Analytics Dashboard Implementation

This is a large implementation. I will split it into focused hooks and section components that compose into the restructured Analytics page.

## Architecture

The current `useAnalyticsMetrics` hook is already large. Rather than bloating it further, I will create focused hooks per section that share the same tenant/job resolution pattern. Each section gets its own data hook and presentation component.

```text
src/hooks/
  useAnalyticsMetrics.ts          ← EXTEND (add offered_at, candidate_id to association query)
  useStagePerformanceMetrics.ts   ← NEW (stage history, time in stage, stuck candidates)
  useJobHealthMetrics.ts          ← NEW (per-job breakdown table)
  useRecruiterPerformanceMetrics.ts ← NEW (added_by workload)
  useSourcePerformanceMetrics.ts  ← NEW (candidates.source join)
  useInterviewHealthMetrics.ts    ← NEW (scheduled_bookings deep)
  useOfferAnalyticsMetrics.ts     ← NEW (offered_at, offer→hire)
  useTalentInsightsMetrics.ts     ← NEW (seniority, skills, geography, experience)

src/components/analytics/
  sections/
    OverviewSection.tsx           ← NEW (KPI cards + trend)
    PipelineHealthSection.tsx     ← NEW (funnel + pie + pipeline table)
    StagePerformanceSection.tsx   ← NEW (distribution + time in stage + stuck)
    JobHealthSection.tsx          ← NEW (sortable job table)
    RecruiterPerformanceSection.tsx ← NEW (workload table)
    SourcePerformanceSection.tsx  ← NEW (bar chart + table)
    InterviewHealthSection.tsx    ← NEW (KPIs + trend)
    OfferAnalyticsSection.tsx     ← NEW (offer metrics)
    TalentInsightsSection.tsx     ← NEW (distributions)
  charts/
    SourceBarChart.tsx            ← NEW
    TimeInStageChart.tsx          ← NEW
    InterviewTrendChart.tsx       ← NEW
    TalentDistributionChart.tsx   ← NEW
```

## Data Strategy per Section

### 1. Overview Section
- **Already exists.** Keep current 7 KPI cards + trend chart + add "Offers" as 8th KPI (already computed as `totalOffers`).
- Restructure into `OverviewSection.tsx` component for cleaner page composition.

### 2. Pipeline Health Section
- **Already exists.** Pipeline table, funnel, pie chart.
- Wrap into `PipelineHealthSection.tsx`.

### 3. Stage Performance — `useStagePerformanceMetrics`
Query `job_candidate_stage_history` joined with `job_hiring_stages` for the filtered job IDs:
- **Stage distribution**: already in `useAnalyticsMetrics` (reuse)
- **Avg time in stage**: compute from consecutive `moved_at` timestamps per association (same pattern as `useJobAnalyticsMetrics` lines 343-385)
- **Stuck candidates**: query `job_candidate_associations` where `entered_stage_at < now - threshold` and `status = 'active'`, joining candidate name and job title
- **Stage entry volume**: count `to_stage_id` transitions within date range

### 4. Job Health — `useJobHealthMetrics`
For each job in `finalJobIds`, aggregate from existing `allAssociations` data + bookings:
- total candidates, active, rejected, offers, hires per job
- avg time to hire per job
- Pull job title and status from the jobs query
- Sortable table with warning highlights for jobs with 0 active or high rejection ratio

### 5. Recruiter Performance — `useRecruiterPerformanceMetrics`
Query `job_candidate_associations.added_by` grouped by user:
- candidates added per recruiter (in date range)
- active pipeline load per recruiter
- hires per recruiter
- interviews booked per recruiter (from `scheduled_bookings.booked_by`)
- Join with `profiles` for display names

### 6. Source Performance — `useSourcePerformanceMetrics`
Join `job_candidate_associations` → `candidates` to get `source` field:
- candidates by source
- active by source
- hires by source
- offers by source
- conversion rates (hires/total per source)
- Bar chart + ranked table

### 7. Interview Health — `useInterviewHealthMetrics`
Extend existing bookings queries:
- scheduled count (in range)
- completed count (scheduled_start in past + in range)
- upcoming count (scheduled_start > now)
- completion rate
- daily trend from bookings
- cancellation count (status = 'cancelled' in range)

### 8. Offer Analytics — `useOfferAnalyticsMetrics`
From `job_candidate_associations`:
- `offered_at` is available — count offers in date range
- `status = 'hired'` where `offered_at` exists — offer→hire conversion
- Avg time from offer to hire (offered_at → updated_at for hired)

### 9. Talent Insights — `useTalentInsightsMetrics`
Query `candidates` joined via associations for filtered jobs:
- `seniority_level` distribution
- `standardized_skills` (top N skills)
- `location_country` distribution
- `years_experience` distribution (buckets: 0-2, 3-5, 6-10, 10+)

## Page Layout Changes

`Analytics.tsx` will import all 9 section components and pass shared props (`dateRange`, `filters`, `finalJobIds`). Each section is collapsible via `AnalyticsSection`.

## Files to Create (~20 files)

**Hooks (8):**
1. `src/hooks/useStagePerformanceMetrics.ts`
2. `src/hooks/useJobHealthMetrics.ts`
3. `src/hooks/useRecruiterPerformanceMetrics.ts`
4. `src/hooks/useSourcePerformanceMetrics.ts`
5. `src/hooks/useInterviewHealthMetrics.ts`
6. `src/hooks/useOfferAnalyticsMetrics.ts`
7. `src/hooks/useTalentInsightsMetrics.ts`

**Section Components (9):**
8. `src/components/analytics/sections/OverviewSection.tsx`
9. `src/components/analytics/sections/PipelineHealthSection.tsx`
10. `src/components/analytics/sections/StagePerformanceSection.tsx`
11. `src/components/analytics/sections/JobHealthSection.tsx`
12. `src/components/analytics/sections/RecruiterPerformanceSection.tsx`
13. `src/components/analytics/sections/SourcePerformanceSection.tsx`
14. `src/components/analytics/sections/InterviewHealthSection.tsx`
15. `src/components/analytics/sections/OfferAnalyticsSection.tsx`
16. `src/components/analytics/sections/TalentInsightsSection.tsx`

**Chart Components (4):**
17. `src/components/analytics/charts/SourceBarChart.tsx`
18. `src/components/analytics/charts/TimeInStageChart.tsx`
19. `src/components/analytics/charts/InterviewTrendChart.tsx`
20. `src/components/analytics/charts/TalentDistributionChart.tsx`

## Files to Modify

1. `src/pages/Analytics.tsx` — replace inline sections with imported section components
2. `src/hooks/useAnalyticsMetrics.ts` — add `candidate_id` and `offered_at` to the association select, expose `allAssociations` for downstream hooks

## Design Constraints

- All components use existing Virgilio tokens, `font-poppins`, `Card`, `AnalyticsChartCard`, `AnalyticsTableCard`, `AnalyticsKpiCard`, `AnalyticsInsightCallout`, `AnalyticsSection`
- No mock data — empty states for missing data
- Tenant isolation via member lookup in each hook
- Recharts for all charts (already installed)


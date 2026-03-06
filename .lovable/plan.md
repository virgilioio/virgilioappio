

# Talent Insights Dashboard

## Overview

A new `/talent-insights` page added after Analytics in the nav bar. Visualizes real candidate data from the `candidates` table using recharts. No mocked data — empty states when data is missing.

## Available Data Fields (from `candidates` table)

- `location_city`, `location_state`, `location_country` — geography
- `years_experience` — experience distribution
- `standardized_skills`, `skills` — skills landscape
- `salary_amount`, `salary_currency`, `salary_period` — compensation
- `seniority_level` — seniority breakdown
- `functional_area`, `specialization` — role composition
- `role_current`, `current_job_title`, `standardized_title` — titles
- `enriched_at`, `enrichment_status` — availability signals
- `created_at` — growth trends
- `tenant_id` — tenant isolation

## Architecture

### New Files

1. **`src/pages/TalentInsights.tsx`** — Main page with permission guard (same as Analytics), fetches all data via a single hook, renders section cards
2. **`src/hooks/useTalentInsightsData.ts`** — Single hook that queries `candidates` table with tenant isolation, computes all aggregations client-side
3. **`src/components/talent-insights/SummaryMetricsRow.tsx`** — Top metric cards (Total Candidates, Avg Experience, Median Salary, Most Common Role, Enriched %)
4. **`src/components/talent-insights/GeographyInsights.tsx`** — Country/city bar chart + top locations list (no map library — use horizontal bar chart for countries, cleaner and no extra dependency)
5. **`src/components/talent-insights/ExperienceDistribution.tsx`** — Histogram with 0-2, 3-5, 6-10, 10+ year bands + seniority breakdown pie
6. **`src/components/talent-insights/SkillsLandscape.tsx`** — Horizontal bar chart of top 15 standardized skills
7. **`src/components/talent-insights/CompensationInsights.tsx`** — Salary distribution using recharts bar chart with P25/Median/P75 markers
8. **`src/components/talent-insights/TalentPoolComposition.tsx`** — Bar charts for functional area, seniority, specialization breakdown
9. **`src/components/talent-insights/TalentInsightEmptyState.tsx`** — Reusable empty state with `gio-face-empty.png`

### Modified Files

1. **`src/App.tsx`** — Add lazy import + route `/talent-insights`
2. **`src/components/layout/Header.tsx`** — Add nav item after Analytics with `Lightbulb` icon, same permission as Analytics

## Data Query Strategy

The hook `useTalentInsightsData` will:
- Fetch tenant_id from `members` table (same pattern as analytics hooks)
- Query `candidates` table filtered by `tenant_id`, selecting only needed columns
- Compute all aggregations in JS (counts, distributions, percentiles)
- Return structured data for each section + loading/empty states

Key query (single efficient fetch):
```ts
supabase.from('candidates')
  .select('location_country, location_city, location_state, years_experience, seniority_level, standardized_skills, skills, salary_amount, salary_currency, salary_period, functional_area, specialization, role_current, standardized_title, enriched_at, created_at')
  .eq('tenant_id', tenantId)
  .is('deleted_at', null)
```

## Visual Design

- Uses existing `MetricCard` component for summary row
- All charts use `recharts` (already installed) with Virgilio Purple palette
- Card-based layout matching the reference images
- Each section is a `Card` with `CardHeader`/`CardContent`
- Responsive grid: 4-col for metrics, 2-col for chart sections
- Empty states use branded Gio face pattern

## Section Details

### Summary Metrics (4 cards)
- Total Candidates (count)
- Avg Years Experience (mean of `years_experience`)
- Median Salary (median of `salary_amount` where available)
- Most Common Role (mode of `standardized_title` or `functional_area`)

Cards hidden if underlying data is entirely null.

### Geography (horizontal bar chart)
- Top 10 countries by candidate count
- Side list showing top cities
- Uses recharts `BarChart` horizontal

### Experience (bar chart + optional pie)
- Grouped into 0-2, 3-5, 6-10, 10+ bands
- If `seniority_level` data exists, show pie chart breakdown

### Skills (horizontal bar chart)
- Top 15 from `standardized_skills` (fallback to `skills`)
- Show frequency count and percentage

### Compensation (bar chart distribution)
- Salary bands with P25/Median/P75 reference lines
- Normalize to annual amounts based on `salary_period`

### Talent Pool Composition (stacked/grouped bars)
- By `functional_area`
- By `seniority_level`
- By `specialization`

## Files Changed
- `src/App.tsx` — add route
- `src/components/layout/Header.tsx` — add nav item
- `src/pages/TalentInsights.tsx` — new page
- `src/hooks/useTalentInsightsData.ts` — new data hook
- `src/components/talent-insights/SummaryMetricsRow.tsx` — new
- `src/components/talent-insights/GeographyInsights.tsx` — new
- `src/components/talent-insights/ExperienceDistribution.tsx` — new
- `src/components/talent-insights/SkillsLandscape.tsx` — new
- `src/components/talent-insights/CompensationInsights.tsx` — new
- `src/components/talent-insights/TalentPoolComposition.tsx` — new
- `src/components/talent-insights/TalentInsightEmptyState.tsx` — new


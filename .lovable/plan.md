

# Global Filtering System for Talent Insights

## Architecture

**Client-side filtering** on the already-fetched candidate array. The current hook already paginate-fetches all candidates into memory. Rather than re-querying Supabase per filter change, we filter the in-memory array and recompute all aggregations. This gives instant filter response with zero additional API calls.

## Available Real Fields (from `candidates` table)

Based on the actual schema, these fields exist and will power filters:

| Filter Category | Field(s) | UI Control |
|---|---|---|
| **Role** | `standardized_title`, `functional_area`, `specialization`, `seniority_level` | Searchable multi-select |
| **Experience** | `years_experience` | Range slider (min/max) |
| **Skills** | `standardized_skills` (fallback `skills`) | Searchable multi-select with chips |
| **Location** | `location_country`, `location_state`, `location_city` | Searchable multi-select |
| **Compensation** | `salary_amount` (normalized to annual) | Range slider (min/max) |
| **Time** | `created_at` | Date range presets (30d, 90d, 12mo, custom) |

Fields that do NOT exist in the schema and will NOT be rendered: job search status, notice period, work mode preference, company size preference, education, relocation openness, industry preference, employment type.

## Implementation Plan

### 1. Filter State & Context — `src/contexts/TalentInsightsFilterContext.tsx`

React context with a `TalentInsightsFilters` interface:

```ts
interface TalentInsightsFilters {
  roles: string[]           // standardized_title values
  functionalAreas: string[] // functional_area values  
  specializations: string[] // specialization values
  seniorities: string[]     // seniority_level values
  skills: string[]          // skill names
  countries: string[]       // location_country values
  states: string[]          // location_state values
  cities: string[]          // location_city values
  experienceMin: number | null
  experienceMax: number | null
  salaryMin: number | null
  salaryMax: number | null
  dateFrom: Date | null
  dateTo: Date | null
}
```

Provides: `filters`, `setFilter(key, value)`, `removeFilter(key, value)`, `clearAll()`, `activeFilterCount`.

### 2. Refactor Data Hook — `src/hooks/useTalentInsightsData.ts`

- Expand the `CandidateRow` select to also fetch `role_current`, `current_job_title`, `years_in_specialization`, `years_in_leadership`, `company_count`, `avg_tenure_months` (for future Phase 2)
- Export raw candidates separately so filter options can be derived from them
- Split into two parts:
  - `useTalentInsightsRawData()` — fetches and caches raw candidates array
  - `useTalentInsightsData(filters)` — takes filters, applies them to raw candidates, recomputes all aggregations
- Filter application is a pure function: `applyFilters(candidates, filters) → filteredCandidates`

### 3. Filter Options Hook — `src/hooks/useTalentInsightsFilterOptions.ts`

Derives all dropdown options dynamically from the **unfiltered** candidate array:
- Distinct values for each categorical field (sorted by frequency)
- Min/max ranges for numeric fields
- Only returns options that have data; empty categories are hidden

### 4. Filter Bar Component — `src/components/talent-insights/TalentInsightsFilterBar.tsx`

**Top bar** (always visible, horizontal row below page header):
- Role (searchable multi-select)
- Seniority (multi-select)
- Country (searchable multi-select)
- Skills (searchable multi-select with chips)
- Salary range (dual-thumb slider)
- "More Filters" button → opens sheet/drawer

**"More Filters" sheet** — `src/components/talent-insights/TalentInsightsFilterSheet.tsx`:
- Functional Area, Specialization
- State, City (cascading: filtered by selected countries)
- Experience range slider
- Date range (presets + custom date picker)

**Active filter chips** — rendered below the filter bar showing all active filters with individual remove (×) buttons and "Clear all" action.

### 5. Cross-Filtering — Chart Click Handlers

Add `onSegmentClick` callbacks to existing chart components:
- `SkillsLandscape` — clicking a skill bar adds it to skills filter
- `ExperienceDistribution` — clicking a band sets experience range
- `TalentPoolComposition` — clicking a functional area/title adds it to filter
- `GeographyInsights` — clicking a country in the list adds it to country filter
- Each component receives an optional `onFilterApply(key, value)` prop

### 6. Empty State

When filters yield zero candidates, show the `TalentInsightEmptyState` with message "No candidates match the selected filters" and a "Clear filters" button.

### 7. Page Integration — `src/pages/TalentInsights.tsx`

Wrap content in `TalentInsightsFilterProvider`. Render `TalentInsightsFilterBar` between page header and dashboard content. Pass filter context to data hook.

## Files

| Action | File |
|---|---|
| **New** | `src/contexts/TalentInsightsFilterContext.tsx` |
| **New** | `src/hooks/useTalentInsightsFilterOptions.ts` |
| **New** | `src/components/talent-insights/TalentInsightsFilterBar.tsx` |
| **New** | `src/components/talent-insights/TalentInsightsFilterSheet.tsx` |
| **New** | `src/components/talent-insights/ActiveFilterChips.tsx` |
| **Modified** | `src/hooks/useTalentInsightsData.ts` — split raw fetch + filtered aggregation |
| **Modified** | `src/pages/TalentInsights.tsx` — add provider + filter bar |
| **Modified** | `src/components/talent-insights/SkillsLandscape.tsx` — add click handler |
| **Modified** | `src/components/talent-insights/ExperienceDistribution.tsx` — add click handler |
| **Modified** | `src/components/talent-insights/TalentPoolComposition.tsx` — add click handler |
| **Modified** | `src/components/talent-insights/GeographyInsights.tsx` — add click handler |

No database changes needed — all filtering is client-side on already-fetched data.


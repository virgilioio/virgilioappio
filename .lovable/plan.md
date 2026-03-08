

# Rename "Talent Insights" → "Talent Intelligence"

## Summary
Rename the page title, URL slug (`/talent-insights` → `/talent-intelligence`), nav label, and all internal references. File and symbol names will also be updated for consistency.

## Changes

### 1. Route & Navigation
- **`src/App.tsx`**: Change route path from `/talent-insights` to `/talent-intelligence`
- **`src/components/layout/Header.tsx`**: Update nav href from `/talent-insights` to `/talent-intelligence`, update label from `'Insights'` to `'Intelligence'`

### 2. Page
- **`src/pages/TalentInsights.tsx`**: Rename file to `TalentIntelligence.tsx`, update page title string from "Talent Insights" to "Talent Intelligence", update subtitle text accordingly

### 3. Context
- **`src/contexts/TalentInsightsFilterContext.tsx`**: Rename file to `TalentIntelligenceFilterContext.tsx`, rename all exported symbols (`TalentInsightsFilters` → `TalentIntelligenceFilters`, `TalentInsightsFilterProvider` → `TalentIntelligenceFilterProvider`, `useTalentInsightsFilters` → `useTalentIntelligenceFilters`)

### 4. Hooks
- **`src/hooks/useTalentInsightsData.ts`**: Rename file to `useTalentIntelligenceData.ts`, rename exports (`TalentInsightsData` → `TalentIntelligenceData`, `useTalentInsightsData` → `useTalentIntelligenceData`, `useTalentInsightsRawData` → `useTalentIntelligenceRawData`), update query key from `'talent-insights-raw'` to `'talent-intelligence-raw'`
- **`src/hooks/useTalentInsightsFilterOptions.ts`**: Rename file to `useTalentIntelligenceFilterOptions.ts`, rename export

### 5. Components directory
- **`src/components/talent-insights/`**: Rename directory to `src/components/talent-intelligence/`
- Update all internal imports across the 10 component files in this directory
- Rename component-level symbols: `TalentInsightsFilterBar` → `TalentIntelligenceFilterBar`, `TalentInsightsFilterSheet` → `TalentIntelligenceFilterSheet`, `TalentInsightEmptyState` → `TalentIntelligenceEmptyState`

### 6. Import updates
All files importing from the old paths/names will have their imports updated to match the new names. This affects ~15 files total.

No database changes, no API changes, no new dependencies.


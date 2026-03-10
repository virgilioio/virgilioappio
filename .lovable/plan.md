

# Talent Origins — New Visualization for Talent Intelligence

## Overview
Add a "Talent Origins" section to the Talent Intelligence page showing top companies candidates come from, based on real `candidate_work_experience` data. Follows the existing AnalyticsChartCard + horizontal bar chart pattern used by SkillsLandscape and TalentPoolComposition.

## Data Source
The `candidate_work_experience` table already stores:
- `company_name`, `company_logo_url`, `company_industry`, `is_current`, `candidate_id`

No DB changes needed. All data exists.

## Implementation

### 1. New hook: `src/hooks/useTalentOriginsData.ts`
- Fetches `candidate_work_experience` rows for the same tenant (join through candidate_id list from the existing raw data hook)
- Accepts the filtered candidate IDs from the parent page so it respects all active filters
- Aggregates by normalized company name (strip "Inc.", "LLC", "Ltd.", "Corp.", trailing punctuation, case-normalize)
- Returns: `{ companyName, count, logoUrl, industry, currentCount, previousCount }[]` sorted by count desc, top 15
- Segmentation toggle state: `'all' | 'current' | 'previous'`

### 2. New component: `src/components/talent-intelligence/TalentOrigins.tsx`
- Uses `AnalyticsChartCard` wrapper (matches SkillsLandscape exactly)
- Icon: `Building2` from lucide
- Segmented toggle (pill buttons): "All" / "Current" / "Previous" — rendered in the card's `actions` slot
- Horizontal bar chart (recharts BarChart layout="vertical") with:
  - Company logo or initials avatar (24px) next to Y-axis labels via custom tick renderer
  - Purple gradient bars matching SkillsLandscape pattern
  - Pill tooltip showing count + industry if available
- Clicking a bar could filter by company (future enhancement, no filter key exists yet — just log for now)
- Empty state via AnalyticsChartCard's built-in `isEmpty` prop

### 3. Update `src/pages/TalentIntelligence.tsx`
- Import and render `TalentOrigins` in a new full-width row below the existing Composition/Compensation grid
- Pass filtered candidate IDs from `rawCandidates` after filter application

### 4. Company name normalization utility
Simple function in the hook:
```text
"Google LLC" → "Google"
"Google, Inc." → "Google"  
"google" → "Google"
```
Strip common suffixes (Inc, LLC, Ltd, Corp, S.A., S.A. de C.V., GmbH), trim, title-case.

## Visual Design
- Matches SkillsLandscape: same card style, gradient bars, pill tooltip, no grid lines
- Company avatars: 24px rounded-md with `bg-virgilio-purple/10` + initials fallback (first letter, Poppins font)
- Height: `h-[400px]` matching other tall charts
- Segmented toggle: small pill buttons using existing button variant="ghost" with active state

## Files Created/Modified
- **New**: `src/hooks/useTalentOriginsData.ts`
- **New**: `src/components/talent-intelligence/TalentOrigins.tsx`
- **Modified**: `src/pages/TalentIntelligence.tsx` — add TalentOrigins to the layout


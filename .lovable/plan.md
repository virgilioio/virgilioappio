

# Insights Tab — Visual Alignment with Analytics/Intelligence Pages

## Current Gaps

After comparing the Insights tab components with the Analytics and Talent Intelligence visual system, here are the deviations:

### 1. Cards use `bg-surface-primary border-border` instead of `border-virgilio-border`
Analytics cards consistently use `border-virgilio-border` and the Pulse Card elevated style (`rounded-2xl shadow-md hover:shadow-xl`). The Insights tab uses flat cards with no elevation or shadow.

### 2. Score Radial uses generic green/yellow/orange/red instead of Virgilio Purple
The `FitScoreRadial` SVG uses `stroke-green-500`, `stroke-yellow-500`, etc. The brand guidelines demand Virgilio Purple as the primary accent — the radial should use a purple gradient stroke with opacity/saturation variation for score levels, consistent with donut charts in analytics.

### 3. Section headers lack the analytics `icon + Poppins font-semibold` pattern
Card titles in Insights use plain `<CardTitle className="text-sm">` without the icon-badge + Poppins styling used in `AnalyticsChartCard` (purple icon + `font-poppins font-semibold text-virgilio-text`).

### 4. Dimension progress bars use default `bg-primary` with generic score colors
`FitDimensionCard` uses `Progress` with default styling. Analytics uses branded bar styles with rounded-xl and Virgilio Purple gradients.

### 5. Badges use raw Tailwind colors (`bg-green-100`, `bg-orange-100`, `bg-red-100`)
Matches/gaps/priority badges hard-code green/orange/red. Should use the platform's purple-based badge pattern or at minimum the `virgilio-success`/`virgilio-warning` tokens.

### 6. No floating pill tooltip styling
Analytics charts use `rounded-2xl, shadow, Poppins font` tooltip style. The confidence tooltip uses default Radix styling.

### 7. Missing font-poppins on values and labels
Analytics uses `font-poppins` throughout for metric values, labels, and descriptions. Insights tab uses default sans-serif.

## Proposed Changes

### `FitScoreRadial.tsx`
- Replace green/yellow/orange/red stroke colors with Virgilio Purple at varying opacities (100→80: full purple, 60→79: purple/80, 40→59: purple/50, <40: purple/30)
- Add `font-poppins` to score value and confidence badge text
- Style confidence badge with purple tones instead of generic variants

### `FitDimensionCard.tsx`
- Replace generic score-color progress bars with Virgilio Purple indicator (`indicatorClassName="bg-virgilio-purple"`)
- Add `font-poppins` to dimension name and score value
- Replace green/orange hardcoded badge colors with `bg-virgilio-purple/10 text-virgilio-purple` for matches and `bg-virgilio-muted/20 text-virgilio-muted` for gaps
- Use `border-virgilio-border` on the card borders

### `ValidationChecklist.tsx`
- Replace red/yellow priority badge colors with purple-intensity scale (high: `bg-virgilio-purple/20 text-virgilio-purple`, medium: `bg-virgilio-purple/10 text-virgilio-muted`, low: `bg-muted text-muted-foreground`)
- Add `font-poppins` to question text
- Use `border-virgilio-border` on item borders

### `CandidateInsightsTab.tsx`
- Replace all `bg-surface-primary border-border` card classes with `border-virgilio-border rounded-2xl shadow-md hover:shadow-xl transition-all duration-200`
- Add purple icon badges next to section titles (Sparkles for Fit Dimensions, CheckCircle2 for Validation, Database for Data Completeness) using the `AnalyticsChartCard` header pattern
- Add `font-poppins` to section headers and summary text

### `NoJobDescriptionCard.tsx` (if exists)
- Same card elevation and border treatment for consistency

## Files Changed

| File | Change |
|------|--------|
| `src/components/candidates/insights/FitScoreRadial.tsx` | Purple-based radial, Poppins fonts |
| `src/components/candidates/insights/FitDimensionCard.tsx` | Purple progress bars, branded badges, Poppins |
| `src/components/candidates/insights/ValidationChecklist.tsx` | Purple priority scale, branded borders |
| `src/components/candidates/insights/CandidateInsightsTab.tsx` | Elevated cards, icon headers, Poppins throughout |


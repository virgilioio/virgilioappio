

# Salary Insights: Bell Curve Redesign (Brand Purple)

## Overview
Replace the bar chart with a Glassdoor-style bell curve using **Virgilio Purple** (`#7e3eff` / `hsl(267 100% 62%)`) — not green. All styling stays within the existing brand palette.

## File: `src/components/jobs/SalaryInsightsCard.tsx`

### Data transformation
- Replace discrete salary bands with ~30-40 points along a normal distribution curve (mean + stddev from candidate salaries).
- Calculate Low (min), Average (mean), High (max) markers.

### Chart replacement
- Replace `BarChart` + `Bar` with `AreaChart` + `Area` (recharts, already imported).
- `type="monotone"` for smooth curve.
- **Stroke**: `#7e3eff` (accent-foreground / Virgilio Purple).
- **Gradient fill**: `rgba(126, 62, 255, 0.25)` → `transparent` (pastel-purple style).
- Three `ReferenceLine` components for Low / Average / High with labels.
- Hide Y-axis and grid lines. X-axis shows formatted currency values.

### Summary stats
- Keep the 3-column Low / Average / High grid below the chart, unchanged.

### Colors used (all from existing palette)
- Stroke: `#7e3eff` (--accent-foreground)
- Fill gradient: `#d7c5fb` at 30% opacity → transparent (--accent / Lilac Frost)
- Reference lines: `#6F3FF5` (--virgilio-purple)
- Labels: `hsl(var(--muted-foreground))`

## Result
Brand-consistent bell curve with purple gradient, matching the platform's visual identity.


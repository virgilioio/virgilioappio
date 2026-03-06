

# Salary Insights: Hybrid Bar + Curve Chart (Glassdoor Style)

## Concept
Overlay the existing smooth KDE curve on top of a histogram (bar chart) showing salary bins. The bars give discrete, tangible counts of candidates in each salary range, while the curve provides the smooth distribution shape. This is exactly the Glassdoor pattern.

## File: `src/components/jobs/SalaryInsightsCard.tsx`

### Data changes
- Add a `generateHistogram` function that buckets `displaySalaries` into ~10-15 bins, each with a `salary` (bin center) and `count` (number of candidates in that range).
- Merge histogram bins with the KDE curve into a single `ComposedChart` dataset, or use a `ComposedChart` with two separate data sources.

### Chart changes
- Replace `AreaChart` with Recharts `ComposedChart` (import `ComposedChart`, `Bar` alongside existing `Area`).
- Render `Bar` for histogram bins in a lighter purple (`hsl(267 100% 62% / 0.15)` fill, `hsl(267 100% 62% / 0.4)` stroke) with rounded top corners.
- Render `Area` (KDE curve) on top with the existing purple stroke and gradient — unchanged.
- Keep all existing reference lines, tooltip, and X-axis formatting.

### Visual result
- Semi-transparent purple bars showing actual candidate counts per salary band.
- Smooth purple KDE curve overlaid on top.
- Low / Average / High reference lines and summary stats grid unchanged.


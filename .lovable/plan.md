

# Lock in "Pulse Cards" Name + Redesign Charts to Match

## Part 1 — Name & Document the Style

The metric card + sparkline system will be officially named **"Pulse Cards"** — reflecting the live-data heartbeat feel of the sparklines. We'll update the style guide to lock this in.

**File:** `src/components/settings/styleguide/MetricCardGuide.tsx`
- Rename heading from "Metric Cards" to "Pulse Cards"
- Update description to: *"Pulse Cards are the platform's signature KPI component — horizontal pill-style cards with three zones: icon circle, label + value, and an integrated sparkline pulse. Three variants: hero, default, and grouped strips."*

**File:** `src/components/settings/StyleGuide.tsx`
- Rename the import/component reference label if needed for clarity

---

## Part 2 — Redesign the Three Charts

The current charts (Candidates Over Time, Recruitment Funnel, Status Distribution) use standard Recharts defaults — grid lines, basic dots, flat colors. We'll redesign them to share the Pulse Card DNA: gradient fills, rounded surfaces, Virgilio palette, no visual noise.

### A. Candidates Over Time (`ApplicationsTrendChart.tsx`)
**Current:** Multi-line chart with dots, grid, legend at bottom.
**Redesign:**
- Replace `Line` with `Area` + gradient fills (like MiniSparkline uses) for each series
- Remove `CartesianGrid` — replace with subtle horizontal reference lines only
- Remove dot markers, keep `activeDot` on hover only
- Use brand palette: purple (applications), blue (active), green (hires), amber (interviews)
- Style tooltip as a floating Pulse-style pill: rounded-2xl, shadow-md, Poppins font
- Move legend into the card header as small colored chips/badges instead of below the chart

### B. Recruitment Funnel (`RecruitmentFunnelChart.tsx`)
**Current:** Horizontal bars with border-left accent — already decent but flat.
**Redesign:**
- Add subtle gradient fills to each bar (matching the stage color, fading right)
- Round the bar corners more (rounded-xl)
- Add the stage icon or a small colored dot before each label
- Style conversion arrows with a small downward chevron icon instead of pipe characters
- Add a subtle pulse animation or glow on the "Hired" bar to draw the eye to the outcome
- Keep the overall conversion rate footer, add a subtle purple gradient underline

### C. Status Distribution (`CandidateStatusPieChart.tsx`)
**Current:** Standard pie chart with label lines.
**Redesign:**
- Switch to a **donut chart** (innerRadius ~55%) with a center stat (total candidates count)
- Remove `labelLine` — use a clean legend below instead
- Use Virgilio palette colors: purple, green, red, blue, muted
- Add subtle shadow/glow on each segment on hover
- Style tooltip as the same floating pill used in the trend chart
- Add rounded card styling consistent with Pulse Cards (already has AnalyticsChartCard)

### Files to modify
| File | Change |
|------|--------|
| `src/components/settings/styleguide/MetricCardGuide.tsx` | Rename to "Pulse Cards", update description |
| `src/components/analytics/ApplicationsTrendChart.tsx` | Area gradients, remove grid, header legend chips |
| `src/components/analytics/RecruitmentFunnelChart.tsx` | Gradient bars, chevron arrows, hire glow |
| `src/components/analytics/CandidateStatusPieChart.tsx` | Donut with center stat, clean legend, Virgilio palette |


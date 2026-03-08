

# Apply Pulse Cards Branding to Style Guide + Upgrade Talent Intelligence & Pipeline Cards

## What we're doing

1. **Style Guide — Add a Charts section** documenting the new chart design language (area gradients, donut, funnel) alongside the existing Pulse Cards section. This locks in the full visual system.

2. **Talent Intelligence `SummaryMetricsRow`** — Upgrade the 5 metric cards to use the Pulse Card hierarchy properly:
   - **Total Candidates** → `variant="hero"` with a `Users` icon
   - **Remaining 4 cards** (Avg Experience, Median Salary, Top Role, Enriched Profiles) → Wrap in a `MetricCardGroup` as `variant="inline"` cards, creating the signature grouped strip layout
   - Add `iconColor` props using the Virgilio palette (purple, warning, green, destructive)

3. **Pipeline page (`Pipeline.tsx`)** — Already using hero + grouped strip pattern. Enhancements:
   - Add `iconColor` props to differentiate cards visually (purple for Active Jobs, warning for Avg Days, green for Active Candidates)
   - Add icon to the hero card if missing

4. **Style Guide `MetricCardGuide.tsx`** — Already renamed to "Pulse Cards" in the previous step; verify heading and description are locked in.

## Files to modify

| File | Change |
|------|--------|
| `src/components/talent-intelligence/SummaryMetricsRow.tsx` | Restructure to hero + grouped strip using MetricCardGroup |
| `src/pages/Pipeline.tsx` | Add iconColor props to differentiate pipeline cards |
| `src/components/settings/styleguide/MetricCardGuide.tsx` | Confirm "Pulse Cards" branding is locked in |
| `src/components/settings/StyleGuide.tsx` | Add a new `ChartsGuide` section documenting the redesigned chart patterns |
| `src/components/settings/styleguide/ChartsGuide.tsx` | New file — documents Area gradient, Donut, and Funnel chart patterns with live examples |

